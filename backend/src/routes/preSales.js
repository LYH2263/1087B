const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../errors');
const { preSaleReserveSchema } = require('../validators');
const { fromCents } = require('../utils/money');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const config = require('../config');
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = { id: payload.sub, role: payload.role, username: payload.username };
    } catch (error) {
      // ignore invalid token for optional auth
    }
  }
  next();
}

function mapPreSale(preSale) {
  const now = new Date();
  const arrivalDate = new Date(preSale.expectedArrivalDate);

  let status = 'UPCOMING';
  if (preSale.status === 'ARRIVED') {
    status = 'ARRIVED';
  } else if (preSale.status === 'ENDED') {
    status = 'ENDED';
  } else if (now >= arrivalDate) {
    status = 'ONGOING';
  }

  return {
    id: preSale.id,
    bookId: preSale.bookId,
    expectedArrivalDate: preSale.expectedArrivalDate,
    preSaleStock: preSale.preSaleStock,
    reservationCount: preSale.reservationCount,
    remainingStock: preSale.preSaleStock - preSale.reservationCount,
    status,
    arrivedAt: preSale.arrivedAt,
    createdAt: preSale.createdAt,
    book: preSale.book ? {
      id: preSale.book.id,
      title: preSale.book.title,
      author: preSale.book.author,
      coverUrl: preSale.book.coverUrl,
      price: fromCents(preSale.book.priceCents),
      status: preSale.book.status
    } : null
  };
}

function mapReservation(reservation) {
  return {
    id: reservation.id,
    preSaleId: reservation.preSaleId,
    bookId: reservation.bookId,
    status: reservation.status,
    notifiedAt: reservation.notifiedAt,
    createdAt: reservation.createdAt,
    book: reservation.book ? {
      id: reservation.book.id,
      title: reservation.book.title,
      author: reservation.book.author,
      coverUrl: reservation.book.coverUrl,
      price: fromCents(reservation.book.priceCents)
    } : null,
    preSale: reservation.preSale ? {
      id: reservation.preSale.id,
      expectedArrivalDate: reservation.preSale.expectedArrivalDate,
      status: reservation.preSale.status,
      arrivedAt: reservation.preSale.arrivedAt
    } : null
  };
}

function mapNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    content: notification.content,
    relatedId: notification.relatedId,
    read: notification.read,
    createdAt: notification.createdAt
  };
}

router.get('/active', optionalAuth, asyncHandler(async (req, res) => {
  const now = new Date();

  const preSales = await prisma.preSale.findMany({
    where: {
      status: {
        in: ['UPCOMING', 'ONGOING']
      },
      book: {
        status: 'ACTIVE'
      }
    },
    include: {
      book: true
    },
    orderBy: { expectedArrivalDate: 'asc' },
    take: 20
  });

  res.json({
    items: preSales.map(mapPreSale)
  });
}));

router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const preSale = await prisma.preSale.findUnique({
    where: { id: req.params.id },
    include: {
      book: true
    }
  });

  if (!preSale) {
    throw new ApiError(404, 'PRE_SALE_NOT_FOUND');
  }

  const result = mapPreSale(preSale);

  if (req.user) {
    const reservation = await prisma.preSaleReservation.findFirst({
      where: {
        preSaleId: preSale.id,
        userId: req.user.id
      }
    });
    result.userReserved = !!reservation;
    result.reservationId = reservation?.id || null;
  }

  res.json(result);
}));

router.get('/book/:bookId', optionalAuth, asyncHandler(async (req, res) => {
  const preSale = await prisma.preSale.findFirst({
    where: {
      bookId: req.params.bookId,
      status: {
        in: ['UPCOMING', 'ONGOING', 'ARRIVED']
      }
    },
    include: {
      book: true
    }
  });

  if (!preSale) {
    res.json(null);
    return;
  }

  const result = mapPreSale(preSale);

  if (req.user) {
    const reservation = await prisma.preSaleReservation.findFirst({
      where: {
        preSaleId: preSale.id,
        userId: req.user.id
      }
    });
    result.userReserved = !!reservation;
    result.reservationId = reservation?.id || null;
  }

  res.json(result);
}));

router.post('/reserve', requireAuth, asyncHandler(async (req, res) => {
  const payload = preSaleReserveSchema.parse(req.body);

  const preSale = await prisma.preSale.findUnique({
    where: { id: payload.preSaleId },
    include: { book: true }
  });

  if (!preSale) {
    throw new ApiError(404, 'PRE_SALE_NOT_FOUND');
  }

  if (preSale.status === 'ENDED') {
    throw new ApiError(400, 'PRE_SALE_ENDED');
  }

  if (preSale.status === 'ARRIVED') {
    throw new ApiError(400, 'PRE_SALE_ALREADY_ARRIVED');
  }

  if (preSale.book.status !== 'ACTIVE') {
    throw new ApiError(400, 'BOOK_NOT_ACTIVE');
  }

  const remaining = preSale.preSaleStock - preSale.reservationCount;
  if (remaining <= 0) {
    throw new ApiError(400, 'PRE_SALE_OUT_OF_STOCK');
  }

  let reservation;
  try {
    reservation = await prisma.preSaleReservation.create({
      data: {
        preSaleId: preSale.id,
        userId: req.user.id,
        bookId: preSale.bookId
      },
      include: {
        book: true,
        preSale: true
      }
    });

    await prisma.preSale.update({
      where: { id: preSale.id },
      data: {
        reservationCount: { increment: 1 }
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const existing = await prisma.preSaleReservation.findFirst({
        where: {
          preSaleId: preSale.id,
          userId: req.user.id
        },
        include: {
          book: true,
          preSale: true
        }
      });
      return res.json(mapReservation(existing));
    }
    throw error;
  }

  res.status(201).json(mapReservation(reservation));
}));

router.post('/reservations/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const reservation = await prisma.preSaleReservation.findUnique({
    where: { id: req.params.id }
  });

  if (!reservation || reservation.userId !== req.user.id) {
    throw new ApiError(404, 'RESERVATION_NOT_FOUND');
  }

  if (reservation.status !== 'PENDING') {
    throw new ApiError(400, 'RESERVATION_NOT_CANCELABLE');
  }

  await prisma.$transaction(async (tx) => {
    await tx.preSaleReservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELED' }
    });

    await tx.preSale.update({
      where: { id: reservation.preSaleId },
      data: {
        reservationCount: { decrement: 1 }
      }
    });
  });

  const updated = await prisma.preSaleReservation.findUnique({
    where: { id: reservation.id },
    include: {
      book: true,
      preSale: true
    }
  });

  res.json(mapReservation(updated));
}));

router.get('/reservations/mine', requireAuth, asyncHandler(async (req, res) => {
  const { status } = req.query;

  const where = {
    userId: req.user.id
  };

  if (status) {
    where.status = String(status);
  }

  const reservations = await prisma.preSaleReservation.findMany({
    where,
    include: {
      book: true,
      preSale: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(reservations.map(mapReservation));
}));

router.get('/notifications', requireAuth, asyncHandler(async (req, res) => {
  const { read, type } = req.query;

  const where = {
    userId: req.user.id
  };

  if (read !== undefined) {
    where.read = read === 'true';
  }

  if (type) {
    where.type = String(type);
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  const unreadCount = await prisma.notification.count({
    where: {
      userId: req.user.id,
      read: false
    }
  });

  res.json({
    items: notifications.map(mapNotification),
    unreadCount
  });
}));

router.post('/notifications/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id }
  });

  if (!notification || notification.userId !== req.user.id) {
    throw new ApiError(404, 'NOTIFICATION_NOT_FOUND');
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true }
  });

  res.json(mapNotification(updated));
}));

router.post('/notifications/read-all', requireAuth, asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user.id,
      read: false
    },
    data: { read: true }
  });

  res.json({ message: 'all notifications marked as read' });
}));

module.exports = router;
