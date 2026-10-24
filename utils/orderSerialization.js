const internalOrderFields = [
  "currentPaymentRef",
  "paymentRequestDate",
  "paymentCheckAttempts",
  "inventoryReleasedAt",
  "soldCountCommitted",
  "checkoutSessionId",
  "deliveryVerification",
];

export const serializeOrder = (order) => {
  if (!order) return order;
  const result = typeof order.toObject === "function" ? order.toObject() : { ...order };
  for (const field of internalOrderFields) delete result[field];
  return result;
};
