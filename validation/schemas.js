import Joi from "joi";

const objectId = Joi.string().hex().length(24);
const shortText = Joi.string().trim().max(255);
const longText = Joi.string().trim().max(10_000);
const positiveMoney = Joi.number().min(0).max(1_000_000_000);
const productItem = Joi.object({
  productId: objectId.required(),
  quantity: Joi.number().integer().min(1).max(100).required(),
  price: positiveMoney,
});

export const objectIdParams = (name = "id") =>
  Joi.object({ [name]: objectId.required() });
export const slugOrIdParams = (name = "id") =>
  Joi.object({ [name]: Joi.alternatives().try(objectId, Joi.string().trim().pattern(/^[a-z0-9-]+$/).max(200)).required() });
export const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).max(100_000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(200),
  q: Joi.string().trim().max(200),
  sort: Joi.string().valid("newest", "oldest", "price_asc", "price_desc", "popular"),
  status: Joi.string().trim().max(50),
  role: Joi.string().valid("user", "shipper", "admin", "super_admin"),
  type: Joi.string().trim().max(50),
  region: Joi.string().valid("bac", "trung", "nam"),
  category: objectId,
  categoryId: objectId,
}).unknown(true);
export const loginSchema = Joi.object({
  username: Joi.string().trim().min(3).max(254).required(),
  password: Joi.string().min(6).max(128).required(),
});
export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  username: Joi.string().trim().lowercase().alphanum().min(3).max(40).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(8).max(128).required(),
  confirmPassword: Joi.ref("password"),
});
export const orderSchema = Joi.object({
  items: Joi.array().items(productItem).min(1).max(100).required(),
  address: objectId.required(),
  couponCode: Joi.string().trim().uppercase().max(50).allow("", null),
  source: Joi.string().valid("cart", "buy_now", "menu", "recipe").required(),
  paymentMethod: Joi.string().valid("cod", "vnpay").required(),
  platform: Joi.string().valid("web").default("web"),
});

export const emailSchema = Joi.object({ email: Joi.string().trim().lowercase().email().required() });
export const otpSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  type: Joi.string().valid("verify", "reset"),
});
export const resetPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});
export const refreshSchema = Joi.object({ token: Joi.string().max(5000) }).unknown(false);
export const addressSchema = Joi.object({
  name: shortText.min(2).required(),
  phone: Joi.string().pattern(/^(?:\+84|0)\d{9,10}$/).required(),
  address: Joi.string().trim().min(5).max(500).required(),
  isDefault: Joi.boolean(),
});
export const addressUpdateSchema = addressSchema.fork(["name", "phone", "address"], (schema) => schema.optional()).min(1);
export const productIdSchema = Joi.object({
  productId: objectId.required(),
  quantity: Joi.number().integer().min(1).max(100).default(1),
});
export const productIdsSchema = Joi.object({
  productIds: Joi.array().items(objectId).min(1).max(100).unique().required(),
});
export const categoryViewSchema = Joi.object({ categoryId: objectId.required() });
export const checkoutPreviewSchema = Joi.object({
  items: Joi.array().items(productItem).min(1).max(100).required(),
});
export const couponCreateSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).max(50).required(),
  type: Joi.string().valid("percentage", "fixed").required(),
  value: positiveMoney.required(),
  maxDiscount: positiveMoney.default(0),
  minOrderValue: positiveMoney.default(0),
  usageLimit: Joi.number().integer().min(1).max(10_000_000).required(),
  userLimit: Joi.number().integer().min(1).max(10_000).default(1),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
});
export const couponApplySchema = Joi.object({
  code: Joi.string().trim().uppercase().max(50).required(),
  items: Joi.array().items(productItem).min(1).max(100).required(),
  totalAmount: positiveMoney.required(),
});
export const cancelOrderSchema = Joi.object({ reason: Joi.string().trim().min(5).max(255).required() });
export const chatbotSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
  history: Joi.array().items(Joi.object({
    role: Joi.string().valid("user", "model", "assistant").required(),
    parts: Joi.array().items(Joi.object({ text: Joi.string().max(2000).required() })).min(1).max(10).required(),
  })).max(20).default([]),
});
export const notificationSchema = Joi.object({
  userId: objectId.required(),
  title: shortText.required(),
  body: Joi.string().trim().max(2000).required(),
  metadata: Joi.object().max(30).default({}),
});
export const shipperStatusSchema = Joi.object({
  orderId: objectId.required(),
  nextStatus: Joi.string().valid("confirmed", "shipping", "delivered").required(),
});
export const shipperCancelSchema = Joi.object({
  orderId: objectId.required(),
  reason: Joi.string().trim().min(10).max(255).required(),
});
export const onlineSchema = Joi.object({ isOnline: Joi.boolean().required() });
export const shippingFeeSchema = Joi.object({
  shippingFee: Joi.number().integer().min(0).max(10_000_000).required(),
});
export const locationSchema = Joi.object({
  orderId: objectId.required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});
export const categorySchema = Joi.object({
  name: shortText.min(2).required(),
  title: shortText,
  description: longText,
  type: Joi.string().trim().max(50),
});
export const saleSchema = Joi.object({
  percent: Joi.number().min(0).max(100).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
  isActive: Joi.boolean(),
});
export const catalogSchema = Joi.object({
  name: shortText,
  title: shortText,
  description: longText,
  price: positiveMoney,
  stock: Joi.number().integer().min(0).max(100_000_000),
  unit: shortText,
  region: Joi.string().valid("bac", "trung", "nam"),
  categoryId: objectId,
  category: objectId,
  percent: Joi.number().min(0).max(100),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  isActive: Joi.boolean(),
  nutrition: Joi.alternatives().try(Joi.object(), Joi.string().max(20_000)),
  season: Joi.alternatives().try(Joi.array().max(50), Joi.string().max(20_000)),
  usage_instruction: Joi.alternatives().try(Joi.array().max(100), Joi.string().max(20_000)),
  ingredients: Joi.alternatives().try(Joi.array().max(200), Joi.string().max(20_000)),
  instructions: Joi.alternatives().try(Joi.array().max(200), Joi.string().max(20_000)),
  recipes: Joi.alternatives().try(Joi.array().items(objectId).max(100), Joi.string().max(20_000)),
  cookTime: Joi.number().integer().min(0).max(100_000),
  familyNotes: longText,
}).unknown(true);
export const adminUserSchema = Joi.object({
  name: shortText.min(2).required(),
  username: Joi.string().trim().lowercase().alphanum().min(3).max(40).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(8).max(128).required(),
  phone: Joi.string().pattern(/^(?:\+84|0)\d{9,10}$/),
  role: Joi.string().valid("admin", "shipper", "super_admin").required(),
});
export const adminUserUpdateSchema = adminUserSchema
  .fork(["name", "username", "email", "password", "role"], (schema) => schema.optional())
  .min(1);
export const assignOrderSchema = Joi.object({ orderId: objectId.required(), shipperId: objectId.required() });
export const adminCancelSchema = Joi.object({
  orderId: objectId.required(),
  action: Joi.string().valid("approve", "reject"),
  adminNote: Joi.string().trim().max(500).allow(""),
});
