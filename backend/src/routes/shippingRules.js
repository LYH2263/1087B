const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../errors');
const { fromCents, toCents } = require('../utils/money');
const { shippingRuleCreateSchema, shippingRuleUpdateSchema } = require('../validators');

const router = express.Router();

function mapRule(rule) {
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    fee: fromCents(rule.feeCents),
    freeThreshold: rule.freeThresholdCents ? fromCents(rule.freeThresholdCents) : null,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const rules = await prisma.shippingRule.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(rules.map(mapRule));
}));

router.post('/', asyncHandler(async (req, res) => {
  const payload = shippingRuleCreateSchema.parse(req.body);
  const rule = await prisma.shippingRule.create({
    data: {
      name: payload.name,
      type: payload.type,
      feeCents: toCents(payload.fee),
      freeThresholdCents: payload.freeThreshold ? toCents(payload.freeThreshold) : null,
      isActive: payload.isActive ?? true
    }
  });
  res.status(201).json(mapRule(rule));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const payload = shippingRuleUpdateSchema.parse(req.body);
  const existing = await prisma.shippingRule.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'SHIPPING_RULE_NOT_FOUND');

  const data = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.type !== undefined) data.type = payload.type;
  if (payload.fee !== undefined) data.feeCents = toCents(payload.fee);
  if (payload.freeThreshold !== undefined) data.freeThresholdCents = payload.freeThreshold ? toCents(payload.freeThreshold) : null;
  if (payload.isActive !== undefined) data.isActive = payload.isActive;

  const rule = await prisma.shippingRule.update({
    where: { id: req.params.id },
    data
  });
  res.json(mapRule(rule));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.shippingRule.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'SHIPPING_RULE_NOT_FOUND');
  await prisma.shippingRule.delete({ where: { id: req.params.id } });
  res.json({ message: 'shipping rule deleted' });
}));

module.exports = router;
