const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../errors');
const { requireAuth } = require('../middleware/auth');
const { questionSchema, answerSchema } = require('../validators');

const router = express.Router();

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapQuestion(question, currentUserId) {
  const answerCount = question.answers ? question.answers.length : (question._count?.answers || 0);
  return {
    id: question.id,
    bookId: question.bookId,
    content: question.content,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    answerCount,
    user: question.user ? {
      id: question.user.id,
      username: question.user.username
    } : null,
    isOwn: currentUserId ? question.userId === currentUserId : false
  };
}

function mapAnswer(answer, currentUserId) {
  const likeCount = answer._count?.likes || (answer.likes ? answer.likes.length : 0);
  const hasLiked = currentUserId
    ? answer.likes
      ? answer.likes.some(l => l.userId === currentUserId)
      : false
    : false;
  return {
    id: answer.id,
    questionId: answer.questionId,
    content: answer.content,
    createdAt: answer.createdAt,
    updatedAt: answer.updatedAt,
    likeCount,
    hasLiked,
    user: answer.user ? {
      id: answer.user.id,
      username: answer.user.username,
      role: answer.user.role
    } : null,
    isOwn: currentUserId ? answer.userId === currentUserId : false,
    isAdmin: answer.user ? answer.user.role === 'ADMIN' : false
  };
}

async function checkUserPurchasedBook(userId, bookId) {
  const order = await prisma.order.findFirst({
    where: {
      userId,
      status: { in: ['PAID', 'SHIPPED', 'COMPLETED'] },
      items: { some: { bookId } }
    }
  });
  return !!order;
}

router.get('/books/:bookId/questions', asyncHandler(async (req, res) => {
  const bookId = req.params.bookId;
  const { sort = 'time', page = 1, pageSize = 10 } = req.query;

  const book = await prisma.book.findUnique({
    where: { id: bookId }
  });
  if (!book) {
    throw new ApiError(404, 'BOOK_NOT_FOUND');
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const currentPageSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10));
  const skip = (currentPage - 1) * currentPageSize;

  let questionOrderBy = { createdAt: 'desc' };
  let answerOrderBy = { createdAt: 'desc' };

  if (sort === 'hot') {
    answerOrderBy = { likes: { _count: 'desc' } };
  } else if (sort === 'time_asc') {
    answerOrderBy = { createdAt: 'asc' };
  }

  const where = { bookId };

  const [questions, totalCount] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        user: { select: { id: true, username: true } },
        answers: {
          include: {
            user: { select: { id: true, username: true, role: true } },
            likes: req.user ? { where: { userId: req.user.id } } : false,
            _count: { select: { likes: true } }
          },
          orderBy: answerOrderBy
        },
        _count: { select: { answers: true } }
      },
      orderBy: questionOrderBy,
      skip,
      take: currentPageSize
    }),
    prisma.question.count({ where })
  ]);

  const currentUserId = req.user?.id;
  const data = questions.map(q => {
    const question = mapQuestion(q, currentUserId);
    question.answers = q.answers.map(a => mapAnswer(a, currentUserId));
    return question;
  });

  res.json({
    items: data,
    total: totalCount,
    page: currentPage,
    pageSize: currentPageSize,
    totalPages: Math.ceil(totalCount / currentPageSize),
    sort
  });
}));

router.post('/books/:bookId/questions', requireAuth, asyncHandler(async (req, res) => {
  const bookId = req.params.bookId;
  const payload = questionSchema.parse(req.body);
  const userId = req.user.id;

  const book = await prisma.book.findUnique({
    where: { id: bookId, status: 'ACTIVE' }
  });
  if (!book) {
    throw new ApiError(404, 'BOOK_NOT_FOUND');
  }

  const safeContent = escapeHtml(payload.content);

  const question = await prisma.question.create({
    data: {
      bookId,
      userId,
      content: safeContent
    },
    include: {
      user: { select: { id: true, username: true } }
    }
  });

  res.status(201).json(mapQuestion(question, userId));
}));

router.post('/questions/:questionId/answers', requireAuth, asyncHandler(async (req, res) => {
  const questionId = req.params.questionId;
  const payload = answerSchema.parse(req.body);
  const userId = req.user.id;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { book: true }
  });
  if (!question) {
    throw new ApiError(404, 'QUESTION_NOT_FOUND');
  }

  const isAdmin = req.user.role === 'ADMIN';
  const hasPurchased = await checkUserPurchasedBook(userId, question.bookId);

  if (!isAdmin && !hasPurchased) {
    throw new ApiError(403, 'ANSWER_PERMISSION_DENIED');
  }

  const safeContent = escapeHtml(payload.content);

  const answer = await prisma.answer.create({
    data: {
      questionId,
      userId,
      content: safeContent
    },
    include: {
      user: { select: { id: true, username: true, role: true } },
      likes: { where: { userId } },
      _count: { select: { likes: true } }
    }
  });

  res.status(201).json(mapAnswer(answer, userId));
}));

router.post('/answers/:answerId/like', requireAuth, asyncHandler(async (req, res) => {
  const answerId = req.params.answerId;
  const userId = req.user.id;

  const answer = await prisma.answer.findUnique({
    where: { id: answerId }
  });
  if (!answer) {
    throw new ApiError(404, 'ANSWER_NOT_FOUND');
  }

  try {
    await prisma.answerLike.create({
      data: { answerId, userId }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      await prisma.answerLike.delete({
        where: { answerId_userId: { answerId, userId } }
      });
      const updatedAnswer = await prisma.answer.findUnique({
        where: { id: answerId },
        include: {
          user: { select: { id: true, username: true, role: true } },
          likes: { where: { userId } },
          _count: { select: { likes: true } }
        }
      });
      return res.json({ ...mapAnswer(updatedAnswer, userId), liked: false });
    }
    throw error;
  }

  const updatedAnswer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      user: { select: { id: true, username: true, role: true } },
      likes: { where: { userId } },
      _count: { select: { likes: true } }
    }
  });

  res.json({ ...mapAnswer(updatedAnswer, userId), liked: true });
}));

module.exports = router;
