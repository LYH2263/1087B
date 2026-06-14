const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { fromCents } = require('../utils/money');
const { ApiError } = require('../errors');

const router = express.Router();

function mapBookListPublic(bookList) {
  return {
    id: bookList.id,
    title: bookList.title,
    coverUrl: bookList.coverUrl,
    description: bookList.description,
    sortOrder: bookList.sortOrder,
    createdAt: bookList.createdAt,
    itemCount: bookList.items ? bookList.items.length : 0,
    items: bookList.items ? bookList.items.map(item => ({
      id: item.id,
      bookId: item.bookId,
      sortOrder: item.sortOrder,
      book: item.book ? {
        id: item.book.id,
        title: item.book.title,
        author: item.book.author,
        coverUrl: item.book.coverUrl,
        price: fromCents(item.book.priceCents),
        stock: item.book.stock,
        status: item.book.status,
        isActive: item.book.status === 'ACTIVE'
      } : null
    })) : []
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const bookLists = await prisma.bookList.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      items: {
        include: { book: true },
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });

  res.json(bookLists.map(mapBookListPublic));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const bookList = await prisma.bookList.findUnique({
    where: { id: req.params.id },
    include: {
      items: {
        include: { book: true },
        orderBy: { sortOrder: 'asc' }
      }
    }
  });

  if (!bookList || bookList.status !== 'PUBLISHED') {
    throw new ApiError(404, 'BOOK_LIST_NOT_FOUND');
  }

  res.json(mapBookListPublic(bookList));
}));

module.exports = router;
