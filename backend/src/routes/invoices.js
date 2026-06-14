const express = require('express');
const prisma = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../errors');
const { invoiceApplySchema } = require('../validators');
const { fromCents } = require('../utils/money');

const router = express.Router();

function mapInvoice(invoice) {
  return {
    id: invoice.id,
    orderId: invoice.orderId,
    status: invoice.status,
    titleType: invoice.titleType,
    titleName: invoice.titleName,
    taxNumber: invoice.taxNumber,
    email: invoice.email,
    invoiceNumber: invoice.invoiceNumber,
    invoiceContent: invoice.invoiceContent,
    pdfUrl: invoice.pdfUrl,
    rejectReason: invoice.rejectReason,
    issuedAt: invoice.issuedAt,
    rejectedAt: invoice.rejectedAt,
    createdAt: invoice.createdAt,
    order: invoice.order ? {
      id: invoice.order.id,
      total: fromCents(invoice.order.totalCents),
      status: invoice.order.status,
      createdAt: invoice.order.createdAt,
      items: invoice.order.items?.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: fromCents(item.priceCents)
      }))
    } : null
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { userId: req.user.id },
    include: {
      order: {
        include: { items: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(invoices.map(mapInvoice));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      order: {
        include: { items: true }
      }
    }
  });

  if (!invoice || invoice.userId !== req.user.id) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND');
  }

  res.json(mapInvoice(invoice));
}));

router.post('/apply', asyncHandler(async (req, res) => {
  const payload = invoiceApplySchema.parse(req.body);

  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: { items: true }
  });

  if (!order || order.userId !== req.user.id) {
    throw new ApiError(404, 'ORDER_NOT_FOUND');
  }

  if (order.status === 'REFUNDED') {
    throw new ApiError(400, 'ORDER_REFUNDED_CANNOT_INVOICE');
  }

  if (order.status === 'PENDING_PAYMENT' || order.status === 'CANCELED') {
    throw new ApiError(400, 'ORDER_NOT_PAID');
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      orderId: payload.orderId,
      status: { in: ['PENDING', 'ISSUED'] }
    }
  });

  if (existingInvoice) {
    throw new ApiError(400, 'INVOICE_ALREADY_EXISTS');
  }

  const invoice = await prisma.invoice.create({
    data: {
      orderId: payload.orderId,
      userId: req.user.id,
      titleType: payload.titleType,
      titleName: payload.titleName,
      taxNumber: payload.titleType === 'ENTERPRISE' ? payload.taxNumber : null,
      email: payload.email,
      status: 'PENDING'
    },
    include: {
      order: {
        include: { items: true }
      }
    }
  });

  res.status(201).json(mapInvoice(invoice));
}));

module.exports = router;
