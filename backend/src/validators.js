const { z } = require('zod');

const passwordRule = z
  .string()
  .min(8, '密码至少 8 位')
  .regex(/[A-Z]/, '至少包含一个大写字母')
  .regex(/[a-z]/, '至少包含一个小写字母')
  .regex(/[0-9]/, '至少包含一个数字');

const phoneRule = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');

const registerSchema = z.object({
  username: z.string().min(2, '用户名过短').max(20, '用户名过长'),
  password: passwordRule,
  phone: phoneRule,
  email: z.string().email('邮箱格式不正确')
});

const loginSchema = z.object({
  account: z.string().min(2),
  password: z.string().min(6),
  remember: z.boolean().optional()
});

const forgotPasswordSchema = z.object({
  account: z.string().min(2),
  method: z.enum(['email', 'sms'])
});

const resetPasswordSchema = z.object({
  token: z.string().min(6),
  newPassword: passwordRule
});

const coverUrlRule = z
  .string()
  .min(1, '封面必填')
  .refine(
    (value) =>
      value.startsWith('/uploads/') ||
      value.startsWith('/covers/') ||
      /^https?:\/\//.test(value),
    '封面地址不合法'
  );

const bookSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  isbn: z.string().regex(/^[0-9X]{10,13}$/, 'ISBN 格式不正确'),
  description: z.string().min(10),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  coverUrl: coverUrlRule,
  categoryId: z.string().min(1)
});

const bookUpdateSchema = bookSchema.partial();

const categorySchema = z.object({
  name: z.string().min(1).max(20)
});

const cartAddSchema = z.object({
  bookId: z.string().min(1),
  quantity: z.number().int().min(1).max(99)
});

const cartUpdateSchema = z.object({
  quantity: z.number().int().min(1).max(99)
});

const addressSchema = z.object({
  recipient: z.string().min(1),
  phone: phoneRule,
  line1: z.string().min(3),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(4),
  isDefault: z.boolean().optional()
});

const checkoutSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(['WECHAT', 'ALIPAY', 'CARD', 'COD'])
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(3).max(200)
});

const flashSaleBaseSchema = z.object({
  bookId: z.string().min(1, '请选择参与书籍'),
  salePrice: z.number().positive('秒杀价必须大于0'),
  stock: z.number().int().min(1, '秒杀库存至少1件'),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), '开始时间格式不正确'),
  endTime: z.string().refine((v) => !isNaN(Date.parse(v)), '结束时间格式不正确'),
  perUserLimit: z.number().int().min(1, '每人限购至少1件').default(1)
});

const flashSaleCreateSchema = flashSaleBaseSchema.refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: '结束时间必须晚于开始时间',
  path: ['endTime']
});

const flashSaleUpdateSchema = flashSaleBaseSchema.partial().refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return new Date(data.endTime) > new Date(data.startTime);
    }
    return true;
  },
  {
    message: '结束时间必须晚于开始时间',
    path: ['endTime']
  }
);

const flashSalePurchaseSchema = z.object({
  flashSaleId: z.string().min(1),
  quantity: z.number().int().min(1, '购买数量至少1件').max(99, '购买数量不能超过99件'),
  addressId: z.string().min(1, '请选择收货地址'),
  paymentMethod: z.enum(['WECHAT', 'ALIPAY', 'CARD', 'COD'])
});

const taxNumberRule = z
  .string()
  .regex(/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/, '企业税号格式不正确');

const invoiceApplySchema = z.object({
  orderId: z.string().min(1, '请选择订单'),
  titleType: z.enum(['PERSONAL', 'ENTERPRISE'], { required_error: '请选择抬头类型' }),
  titleName: z.string().min(1, '请输入抬头名称'),
  taxNumber: z.string().optional(),
  email: z.string().email('邮箱格式不正确')
}).refine((data) => {
  if (data.titleType === 'ENTERPRISE') {
    return !!data.taxNumber;
  }
  return true;
}, { message: '企业抬头必须填写税号', path: ['taxNumber'] }).refine((data) => {
  if (data.titleType === 'ENTERPRISE' && data.taxNumber) {
    return /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(data.taxNumber);
  }
  return true;
}, { message: '企业税号格式不正确', path: ['taxNumber'] });

const invoiceRejectSchema = z.object({
  reason: z.string().min(1, '请填写驳回原因')
});

const bookListBaseSchema = z.object({
  title: z.string().min(1, '书单标题不能为空').max(100, '书单标题不能超过100个字符'),
  coverUrl: coverUrlRule,
  description: z.string().min(1, '书单简介不能为空').max(500, '书单简介不能超过500个字符'),
  sortOrder: z.number().int().min(0, '排序值不能为负数').default(0)
});

const bookListCreateSchema = bookListBaseSchema;

const bookListUpdateSchema = bookListBaseSchema.partial();

const bookListAddBookSchema = z.object({
  bookId: z.string().min(1, '请选择书籍')
});

const bookListReorderBooksSchema = z.object({
  bookIds: z.array(z.string()).min(1, '至少需要一本书籍')
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  bookSchema,
  bookUpdateSchema,
  categorySchema,
  cartAddSchema,
  cartUpdateSchema,
  addressSchema,
  checkoutSchema,
  reviewSchema,
  flashSaleCreateSchema,
  flashSaleUpdateSchema,
  flashSalePurchaseSchema,
  invoiceApplySchema,
  invoiceRejectSchema,
  taxNumberRule,
  bookListCreateSchema,
  bookListUpdateSchema,
  bookListAddBookSchema,
  bookListReorderBooksSchema
};
