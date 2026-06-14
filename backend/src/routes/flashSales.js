const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { toCents, fromCents } = require('../utils/money');
const { ApiError } = require('../errors');
const { requireAuth } = require('../middleware/auth');
const { flashSalePurchaseSchema } = require('../validators');

const router = express.Router();

function mapFlashSale(flashSale, serverTime = null) {
  const now = serverTime || new Date();
  const startTime = new Date(flashSale.startTime);
  const endTime = new Date(flashSale.endTime);

  let status = 'UPCOMING';
  if (now >= startTime && now <= endTime) {
    status = 'ONGOING';
  } else if (now > endTime) {
    status = 'ENDED';
  }

  const remainingStock = flashSale.stock - flashSale.soldCount;
  const stockPercent = Math.max(0, Math.min(100, (remainingStock / flashSale.stock) * 100));

  return {
    id: flashSale.id,
    bookId: flashSale.bookId,
    book: flashSale.book ? {
      id: flashSale.book.id,
      title: flashSale.book.title,
      author: flashSale.book.author,
      coverUrl: flashSale.book.coverUrl,
      originalPrice: fromCents(flashSale.book.priceCents)
    } : null,
    salePrice: fromCents(flashSale.salePriceCents),
    originalPrice: flashSale.book ? fromCents(flashSale.book.priceCents) : null,
    stock: flashSale.stock,
    soldCount: flashSale.soldCount,
    remainingStock,
    stockPercent,
    startTime: flashSale.startTime,
    endTime: flashSale.endTime,
    perUserLimit: flashSale.perUserLimit,
    status,
    serverTime: serverTime ? serverTime.toISOString() : null,
    countdownMs: status === 'UPCOMING' ? startTime.getTime() - now.getTime() :
                 status === 'ONGOING' ? endTime.getTime() - now.getTime() : 0
  };
}

router.get('/time', asyncHandler(async (req, res) => {
  res.json({ serverTime: new Date().toISOString() });
}));

router.get('/active', asyncHandler(async (req, res) => {
  const serverTime = new Date();
  const bufferTime = new Date(serverTime.getTime() + 24 * 60 * 60 * 1000);

  const flashSales = await prisma.flashSale.findMany({
    where: {
      endTime: {
        gte: new Date(serverTime.getTime() - 60 * 60 * 1000)
      },
      startTime: {
        lte: bufferTime
      },
      book: {
        status: 'ACTIVE'
      }
    },
    include: {
      book: true
    },
    orderBy: [
      { startTime: 'asc' }
    ],
    take: 10
  });

  const result = flashSales.map(fs => mapFlashSale(fs, serverTime));
  result.sort((a, b) => {
    const order = { ONGOING: 0, UPCOMING: 1, ENDED: 2 };
    return order[a.status] - order[b.status];
  });

  res.json({
    serverTime: serverTime.toISOString(),
    items: result
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const serverTime = new Date();
  const flashSale = await prisma.flashSale.findUnique({
    where: { id: req.params.id },
    include: { book: true }
  });

  if (!flashSale) {
    throw new ApiError(404, 'FLASH_SALE_NOT_FOUND');
  }

  res.json(mapFlashSale(flashSale, serverTime));
}));

router.post('/purchase', requireAuth, asyncHandler(async (req, res) => {
  const payload = flashSalePurchaseSchema.parse(req.body);
  const userId = req.user.id;
  const serverTime = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const flashSale = await tx.flashSale.findUnique({
      where: { id: payload.flashSaleId },
      include: { book: true }
    });

    if (!flashSale) {
      throw new ApiError(404, 'FLASH_SALE_NOT_FOUND');
    }

    if (serverTime < new Date(flashSale.startTime)) {
      throw new ApiError(400, 'FLASH_SALE_NOT_STARTED');
    }

    if (serverTime > new Date(flashSale.endTime)) {
      throw new ApiError(400, 'FLASH_SALE_ENDED');
    }

    if (flashSale.book.status !== 'ACTIVE') {
      throw new ApiError(400, 'BOOK_NOT_ACTIVE');
    }

    const existingOrder = await tx.flashSaleOrder.findUnique({
      where: {
        flashSaleId_userId: {
          flashSaleId: payload.flashSaleId,
          userId
        }
      }
    });

    if (existingOrder) {
      throw new ApiError(400, 'FLASH_SALE_PURCHASE_LIMIT');
    }

    if (payload.quantity > flashSale.perUserLimit) {
      throw new ApiError(400, 'FLASH_SALE_QUANTITY_EXCEEDS_LIMIT');
    }

    const remainingStock = flashSale.stock - flashSale.soldCount;
    if (payload.quantity > remainingStock) {
      throw new ApiError(400, 'FLASH_SALE_OUT_OF_STOCK');
    }

    const updateResult = await tx.flashSale.updateMany({
      where: {
        id: payload.flashSaleId,
        soldCount: {
          lte: flashSale.stock - payload.quantity
        }
      },
      data: {
        soldCount: {
          increment: payload.quantity
        }
      }
    });

    if (updateResult.count === 0) {
      throw new ApiError(400, 'FLASH_SALE_OUT_OF_STOCK');
    }

    const address = await tx.address.findUnique({
      where: { id: payload.addressId, userId }
    });

    if (!address) {
      throw new ApiError(404, 'ADDRESS_NOT_FOUND');
    }

    const totalCents = flashSale.salePriceCents * payload.quantity;

    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING_PAYMENT',
        paymentMethod: payload.paymentMethod,
        totalCents,
        recipient: address.recipient,
        phone: address.phone,
        line1: address.line1,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        items: {
          create: {
            bookId: flashSale.bookId,
            title: flashSale.book.title,
            author: flashSale.book.author,
            coverUrl: flashSale.book.coverUrl,
            priceCents: flashSale.salePriceCents,
            quantity: payload.quantity
          }
        }
      },
      include: { items: true }
    });

    await tx.flashSaleOrder.create({
      data: {
        flashSaleId: payload.flashSaleId,
        userId,
        quantity: payload.quantity,
        orderId: order.id
      }
    });

    return {
      orderId: order.id,
      total: fromCents(totalCents),
      flashSaleId: payload.flashSaleId,
      quantity: payload.quantity
    };
  });

  res.status(201).json(result);
}));

router.get('/orders/mine', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const orders = await prisma.flashSaleOrder.findMany({
    where: { userId },
    include: {
      flashSale: {
        include: { book: true }
      },
      order: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orders.map(item => ({
    id: item.id,
    flashSaleId: item.flashSaleId,
    quantity: item.quantity,
    createdAt: item.createdAt,
    orderId: item.orderId,
    orderStatus: item.order?.status,
    book: item.flashSale.book ? {
      title: item.flashSale.book.title,
      coverUrl: item.flashSale.book.coverUrl
    } : null,
    salePrice: fromCents(item.flashSale.salePriceCents)
  })));
}));

module.exports = router;
