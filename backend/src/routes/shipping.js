const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { fromCents, toCents } = require('../utils/money');

const router = express.Router();

async function getActiveRule(tx) {
  const db = tx || prisma;
  return db.shippingRule.findFirst({ where: { isActive: true } });
}

async function computeShipping(itemsCents, itemCount, rule) {
  if (!rule) return { shippingCents: 0, freeShipping: true, shortAmount: 0 };

  if (rule.freeThresholdCents && itemsCents >= rule.freeThresholdCents) {
    return { shippingCents: 0, freeShipping: true, shortAmount: 0 };
  }

  let shippingCents = 0;
  if (rule.type === 'FIXED') {
    shippingCents = rule.feeCents;
  } else {
    shippingCents = rule.feeCents * itemCount;
  }

  const shortAmount = rule.freeThresholdCents
    ? fromCents(rule.freeThresholdCents - itemsCents)
    : 0;

  return { shippingCents, freeShipping: false, shortAmount };
}

router.post('/calculate', asyncHandler(async (req, res) => {
  const { itemAmounts, itemCount } = req.body;

  const amounts = Array.isArray(itemAmounts) ? itemAmounts : [];
  const count = typeof itemCount === 'number' ? itemCount : amounts.length;
  const itemsCents = amounts.reduce((sum, a) => sum + Math.round(Number(a) * 100), 0);

  const rule = await getActiveRule();
  const result = await computeShipping(itemsCents, count, rule);

  res.json({
    itemsAmount: fromCents(itemsCents),
    shippingFee: fromCents(result.shippingCents),
    totalAmount: fromCents(itemsCents + result.shippingCents),
    freeShipping: result.freeShipping,
    shortAmount: result.shortAmount,
    rule: rule ? {
      id: rule.id,
      name: rule.name,
      type: rule.type,
      fee: fromCents(rule.feeCents),
      freeThreshold: rule.freeThresholdCents ? fromCents(rule.freeThresholdCents) : null
    } : null
  });
}));

router.get('/recommendations', asyncHandler(async (req, res) => {
  const shortAmount = Number(req.query.shortAmount) || 0;
  const excludeIds = req.query.excludeIds ? req.query.excludeIds.split(',').filter(Boolean) : [];
  const limit = Math.min(Number(req.query.limit) || 6, 20);

  if (shortAmount <= 0) {
    return res.json({ items: [] });
  }

  const shortCents = toCents(shortAmount);
  const searchRangeCents = shortCents * 3;

  const books = await prisma.book.findMany({
    where: {
      status: 'ACTIVE',
      id: { notIn: excludeIds },
      priceCents: {
        gte: Math.max(1, shortCents),
        lte: searchRangeCents
      }
    },
    orderBy: [
      { priceCents: 'asc' }
    ],
    take: limit * 3
  });

  const scored = books.map(book => {
    const diff = Math.abs(book.priceCents - shortCents);
    return { book, diff, exactMatch: book.priceCents >= shortCents };
  });

  scored.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) return b.exactMatch ? 1 : -1;
    return a.diff - b.diff;
  });

  const items = scored.slice(0, limit).map(s => ({
    id: s.book.id,
    title: s.book.title,
    author: s.book.author,
    coverUrl: s.book.coverUrl,
    price: fromCents(s.book.priceCents),
    stock: s.book.stock
  }));

  res.json({ items, shortAmount });
}));

module.exports = { router, getActiveRule, computeShipping };
