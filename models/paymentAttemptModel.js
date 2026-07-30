import mongoose from "mongoose";

const paymentAttemptSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  attemptRef: {
    type: String,
    required: true,
    unique: true,
  },
  gateway: {
    type: String,
    enum: ["vnpay"],
    default: "vnpay",
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "cancelled", "expired"],
    default: "pending",
    index: true,
  },
  requestDate: String,
  expiresAt: Date,
  gatewayTransactionId: String,
  responseCode: String,
  rawResponse: Object,
}, { timestamps: true });

paymentAttemptSchema.index({ orderId: 1, createdAt: -1 });

export const PaymentAttempt = mongoose.model("PaymentAttempt", paymentAttemptSchema);
