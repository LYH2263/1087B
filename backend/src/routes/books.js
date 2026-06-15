const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { toCents, fromCents } = require('../utils/money');
const { ApiError } = require('../errors');

const router = express.Router();

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

module.exports = router;
