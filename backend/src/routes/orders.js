const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../errors');
const { checkoutSchema, reviewSchema } = require('../validators');
const { fromCents } = require('../utils/money');
const { getActiveRule, computeShipping } = require('./shipping');

const router = express.Router();

const reviewUploadDir = path.join(__dirname, '..', '..', 'uploads', 'reviews');
fs.mkdirSync(reviewUploadDir, { recursive: true });

const MAX_REVIEW_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_REVIEW_IMAGES = 6;
const ALLOWED_REVIEW_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const reviewStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reviewUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `review-${unique}${safeExt}`);
  }
});

const reviewUpload = multer({
  storage: reviewStorage,
  limits: { fileSize: MAX_REVIEW_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_REVIEW_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, 'INVALID_FILE_TYPE'));
    }
    return cb(null, true);
  }
});

function deleteReviewImages(imageUrls) {
  for (const url of imageUrls) {
    try {
      const filePath = path.join(__dirname, '..', '..', url.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // ignore
    }
  }
}

function mapOrder(order) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    total: fromCents(order.totalCents),
    shipping: fromCents(order.shippingCents),
    itemsAmount: fromCents(order.totalCents - order.shippingCents),
    recipient: order.recipient,
    phone: order.phone,
    line1: order.line1,
    city: order.city,
    state: order.state,
    postalCode: order.postalCode,
    rating: order.rating,
    reviewText: order.reviewText,
    reviewImageUrls: order.reviewImageUrls || [],
    likeCount: order._count?.reviewLikes ?? (order.reviewLikes ? order.reviewLikes.length : 0),
    hasLiked: order.reviewLikes ? order.reviewLikes.length > 0 : false,
    reviewedAt: order.reviewedAt,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      title: item.title,
      author: item.author,
      coverUrl: item.coverUrl,
      price: fromCents(item.priceCents),
      quantity: item.quantity
    }))
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: true, _count: { select: { reviewLikes: true } } },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orders.map(mapOrder));
}));

router.post('/checkout', asyncHandler(async (req, res) => {
  const payload = checkoutSchema.parse(req.body);

  const address = await prisma.address.findUnique({
    where: { id: payload.addressId }
  });

  if (!address || address.userId !== req.user.id) {
    throw new ApiError(404, 'ADDRESS_NOT_FOUND');
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { book: { include: { preSale: true } } }
  });

  if (cartItems.length === 0) {
    throw new ApiError(400, 'CART_EMPTY');
  }

  const selectedIds = payload.selectedItemIds;
  const checkoutItems = selectedIds
    ? cartItems.filter(item => selectedIds.includes(item.id))
    : cartItems;

  if (checkoutItems.length === 0) {
    throw new ApiError(400, 'CART_EMPTY');
  }

  for (const item of checkoutItems) {
    if (item.book.status !== 'ACTIVE') {
      throw new ApiError(400, 'BOOK_NOT_AVAILABLE');
    }
    if (item.book.preSale && item.book.preSale.status !== 'ARRIVED' && item.book.preSale.status !== 'ENDED') {
      throw new ApiError(400, 'BOOK_ON_PRE_SALE');
    }
    if (item.book.stock < item.quantity) {
      throw new ApiError(400, 'INSUFFICIENT_STOCK');
    }
  }

  const itemsCents = checkoutItems.reduce(
    (sum, item) => sum + item.book.priceCents * item.quantity,
    0
  );

  const totalItemCount = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);
  const rule = await getActiveRule();
  const shippingResult = await computeShipping(itemsCents, totalItemCount, rule);
  const totalCents = itemsCents + shippingResult.shippingCents;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: req.user.id,
        paymentMethod: payload.paymentMethod,
        totalCents,
        shippingCents: shippingResult.shippingCents,
        recipient: address.recipient,
        phone: address.phone,
        line1: address.line1,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        status: 'PENDING_PAYMENT'
      }
    });

    const orderItems = checkoutItems.map((item) => ({
      orderId: created.id,
      bookId: item.bookId,
      title: item.book.title,
      author: item.book.author,
      coverUrl: item.book.coverUrl,
      priceCents: item.book.priceCents,
      quantity: item.quantity
    }));

    await tx.orderItem.createMany({ data: orderItems });

    for (const item of checkoutItems) {
      await tx.book.update({
        where: { id: item.bookId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    await tx.cartItem.deleteMany({
      where: { userId: req.user.id, id: { in: checkoutItems.map(i => i.id) } }
    });

    return created;
  });

  const fullOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true }
  });

  res.status(201).json(mapOrder(fullOrder));
}));

router.post('/:id/pay', asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true }
  });

  if (!order || order.userId !== req.user.id) {
    throw new ApiError(404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'PENDING_PAYMENT') {
    throw new ApiError(400, 'ORDER_NOT_PAYABLE');
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID' }
    });

    for (const item of order.items) {
      await tx.book.update({
        where: { id: item.bookId },
        data: { sales: { increment: item.quantity } }
      });
    }
  });

  const updated = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true }
  });

  res.json(mapOrder(updated));
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true }
  });

  if (!order || order.userId !== req.user.id) {
    throw new ApiError(404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'PENDING_PAYMENT') {
    throw new ApiError(400, 'ORDER_NOT_CANCELABLE');
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELED' }
    });

    for (const item of order.items) {
      await tx.book.update({
        where: { id: item.bookId },
        data: { stock: { increment: item.quantity } }
      });
    }
  });

  res.json({ message: 'order canceled' });
}));

router.post('/:id/confirm', asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id }
  });

  if (!order || order.userId !== req.user.id) {
    throw new ApiError(404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'SHIPPED') {
    throw new ApiError(400, 'ORDER_NOT_SHIPPED');
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'COMPLETED' }
  });

  res.json({ message: 'order completed' });
}));

router.post('/:id/review', reviewUpload.array('images', MAX_REVIEW_IMAGES), asyncHandler(async (req, res) => {
  const rating = parseInt(req.body.rating, 10);
  const reviewText = req.body.reviewText || '';
  const payload = reviewSchema.parse({ rating, reviewText });

  const order = await prisma.order.findUnique({
    where: { id: req.params.id }
  });

  if (!order || order.userId !== req.user.id) {
    if (req.files && req.files.length > 0) {
      deleteReviewImages(req.files.map(f => `/uploads/reviews/${f.filename}`));
    }
    throw new ApiError(404, 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'COMPLETED') {
    if (req.files && req.files.length > 0) {
      deleteReviewImages(req.files.map(f => `/uploads/reviews/${f.filename}`));
    }
    throw new ApiError(400, 'ORDER_NOT_COMPLETED');
  }

  if (order.reviewedAt) {
    if (req.files && req.files.length > 0) {
      deleteReviewImages(req.files.map(f => `/uploads/reviews/${f.filename}`));
    }
    throw new ApiError(400, 'ORDER_ALREADY_REVIEWED');
  }

  const imageUrls = (req.files || []).map(f => `/uploads/reviews/${f.filename}`);

  try {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        rating: payload.rating,
        reviewText: payload.reviewText,
        reviewImageUrls: imageUrls,
        reviewedAt: new Date()
      }
    });
  } catch (err) {
    deleteReviewImages(imageUrls);
    throw err;
  }

  res.json({ message: 'review submitted', imageUrls });
}));

router.post('/:id/review-like', asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const userId = req.user.id;

  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order || !order.reviewedAt) {
    throw new ApiError(404, 'REVIEW_NOT_FOUND');
  }

  try {
    await prisma.reviewLike.create({
      data: { orderId, userId }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      await prisma.reviewLike.delete({
        where: { orderId_userId: { orderId, userId } }
      });
      return res.json({ liked: false });
    }
    throw error;
  }

  res.json({ liked: true });
}));

module.exports = router;
