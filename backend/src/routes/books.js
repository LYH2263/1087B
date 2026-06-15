const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { toCents, fromCents } = require('../utils/money');
const { ApiError } = require('../errors');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = { id: payload.sub, role: payload.role, username: payload.username };
    } catch (e) {
      // ignore
    }
  }
  next();
}

function mapBook(book) {
  const result = {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    description: book.description,
    price: fromCents(book.priceCents),
    stock: book.stock,
    coverUrl: book.coverUrl,
    sales: book.sales,
    status: book.status,
    category: book.category,
    tags: book.tags ? book.tags.map(bt => ({
      id: bt.tag.id,
      name: bt.tag.name,
      color: bt.tag.color
    })) : []
  };

  if (book.preSale && book.preSale.status !== 'ENDED') {
    const now = new Date();
    const arrivalDate = new Date(book.preSale.expectedArrivalDate);
    let status = 'UPCOMING';
    if (book.preSale.status === 'ARRIVED') {
      status = 'ARRIVED';
    } else if (now >= arrivalDate) {
      status = 'ONGOING';
    }

    result.preSale = {
      id: book.preSale.id,
      expectedArrivalDate: book.preSale.expectedArrivalDate,
      preSaleStock: book.preSale.preSaleStock,
      reservationCount: book.preSale.reservationCount,
      remainingStock: book.preSale.preSaleStock - book.preSale.reservationCount,
      status,
      arrivedAt: book.preSale.arrivedAt
    };
  }

  return result;
}

router.get('/', asyncHandler(async (req, res) => {
  const {
    title,
    author,
    isbn,
    categoryId,
    minPrice,
    maxPrice,
    sort,
    tagIds,
    tagLogic = 'OR'
  } = req.query;

  const where = {
    status: 'ACTIVE'
  };

  if (title) {
    where.title = { contains: String(title), mode: 'insensitive' };
  }

  if (author) {
    where.author = { contains: String(author), mode: 'insensitive' };
  }

  if (isbn) {
    where.isbn = String(isbn);
  }

  if (categoryId) {
    where.categoryId = String(categoryId);
  }

  const min = toCents(minPrice);
  const max = toCents(maxPrice);

  if (min !== null || max !== null) {
    where.priceCents = {};
    if (min !== null) {
      where.priceCents.gte = min;
    }
    if (max !== null) {
      where.priceCents.lte = max;
    }
  }

  let tagIdArray = [];
  if (tagIds) {
    if (Array.isArray(tagIds)) {
      tagIdArray = tagIds.map(String);
    } else {
      tagIdArray = String(tagIds).split(',').filter(Boolean);
    }
  }

  if (tagIdArray.length > 0) {
    const logic = tagLogic === 'AND' ? 'AND' : 'OR';
    
    if (logic === 'AND') {
      where.AND = tagIdArray.map(tagId => ({
        tags: {
          some: { tagId }
        }
      }));
    } else {
      where.tags = {
        some: {
          tagId: { in: tagIdArray }
        }
      };
    }
  }

  let orderBy = { createdAt: 'desc' };
  if (sort === 'price_asc') {
    orderBy = { priceCents: 'asc' };
  }
  if (sort === 'price_desc') {
    orderBy = { priceCents: 'desc' };
  }
  if (sort === 'sales_desc') {
    orderBy = { sales: 'desc' };
  }

  const books = await prisma.book.findMany({
    where,
    include: { 
      category: true,
      tags: {
        include: { tag: true }
      },
      preSale: true
    },
    orderBy
  });

  res.json(books.map(mapBook));
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });
  res.json(categories);
}));

router.get('/tags/cloud', asyncHandler(async (req, res) => {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { books: true }
      }
    }
  });

  const result = tags
    .filter(tag => tag._count.books > 0)
    .map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      bookCount: tag._count.books
    }));

  res.json(result);
}));

router.get('/:id([a-z0-9]{25})', asyncHandler(async (req, res) => {
  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { 
      category: true,
      tags: {
        include: { tag: true }
      },
      preSale: true
    }
  });

  if (!book || book.status !== 'ACTIVE') {
    throw new ApiError(404, 'BOOK_NOT_FOUND');
  }

  res.json(mapBook(book));
}));

router.get('/:id([a-z0-9]{25})/reviews', optionalAuth, asyncHandler(async (req, res) => {
  const bookId = req.params.id;
  const { sort = 'latest', page = 1, pageSize = 10 } = req.query;

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book || book.status !== 'ACTIVE') {
    throw new ApiError(404, 'BOOK_NOT_FOUND');
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const currentPageSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10));
  const skip = (currentPage - 1) * currentPageSize;

  const where = {
    status: 'COMPLETED',
    reviewedAt: { not: null },
    items: { some: { bookId } }
  };

  let orderBy;
  if (sort === 'likes') {
    orderBy = { reviewLikes: { _count: 'desc' } };
  } else if (sort === 'hasImage') {
    orderBy = { reviewedAt: 'desc' };
  } else {
    orderBy = { reviewedAt: 'desc' };
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, username: true } },
        reviewLikes: req.user ? { where: { userId: req.user.id } } : false,
        _count: { select: { reviewLikes: true } }
      },
      orderBy,
      skip,
      take: currentPageSize
    }),
    prisma.order.count({ where })
  ]);

  let reviews = orders.map(order => ({
    id: order.id,
    userId: order.userId,
    username: order.user?.username || '匿名用户',
    rating: order.rating,
    reviewText: order.reviewText,
    reviewImageUrls: order.reviewImageUrls || [],
    likeCount: order._count.reviewLikes,
    hasLiked: req.user ? order.reviewLikes.length > 0 : false,
    reviewedAt: order.reviewedAt
  }));

  if (sort === 'hasImage') {
    reviews.sort((a, b) => {
      const aHas = a.reviewImageUrls.length > 0 ? 0 : 1;
      const bHas = b.reviewImageUrls.length > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return new Date(b.reviewedAt) - new Date(a.reviewedAt);
    });
  }

  res.json({
    items: reviews,
    total: totalCount,
    page: currentPage,
    pageSize: currentPageSize,
    totalPages: Math.ceil(totalCount / currentPageSize),
    sort
  });
}));

module.exports = router;
