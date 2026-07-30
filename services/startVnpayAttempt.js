import crypto from "crypto";
import mongoose from "mongoose";
import { Order } from "../models/ordersModel.js";
import { Transaction } from "../models/transactionModel.js";
import { PaymentAttempt } from "../models/paymentAttemptModel.js";
import { createPaymentUrl } from "./createPaymentUrl.js";

export const startVnpayAttempt = async ({
  order,
  userId,
  ip,
  platform,
  expectedStatuses = ["pending", "checking"],
}) => {
  const attemptRef =
    `${order._id}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const payment = await createPaymentUrl({
    orderId: order._id,
    paymentRef: attemptRef,
    amount: order.totalPrice,
    ip,
    platform,
  });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Order.updateOne(
        {
          _id: order._id,
          paymentStatus: { $in: expectedStatuses },
          inventoryReleasedAt: null,
        },
        {
          status: "pending",
          paymentStatus: "pending",
          currentPaymentRef: attemptRef,
          paymentRequestDate: payment.createDate,
          paymentExpiresAt,
        },
        { session },
      );
      if (updated.modifiedCount !== 1) {
        const error = new Error("Đơn hàng đã thay đổi trạng thái");
        error.statusCode = 409;
        throw error;
      }

      await PaymentAttempt.create([{
        orderId: order._id,
        userId,
        attemptRef,
        amount: order.totalPrice,
        requestDate: payment.createDate,
        expiresAt: paymentExpiresAt,
      }], { session });

      await Transaction.updateOne(
        { orderId: order._id },
        {
          $set: {
            status: "pending",
            ipAddress: ip,
            "gatewayDetails.resumedAt": new Date(),
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    paymentUrl: payment.url,
    paymentExpiresAt,
    paymentRequestDate: payment.createDate,
    paymentRef: attemptRef,
  };
};
