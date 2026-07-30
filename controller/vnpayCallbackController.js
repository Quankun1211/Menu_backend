import crypto from "crypto";
import mongoose from "mongoose";
import { Order } from "../models/ordersModel.js";
import { OrderItem } from "../models/orderItemsModel.js";
import { Transaction } from "../models/transactionModel.js";
import { Coupons } from "../models/couponsModel.js";
import { UserCoupon } from "../models/userCouponModel.js";
import { Cart } from "../models/cartsModel.js";
import { CartItems } from "../models/cartsItemModel.js";
import { releasePendingOrderInventory } from "./orderController.js";
import { sendInternalNotification } from "./notificationController.js";
import { emitOrderUpdated } from "../utils/orderRealtime.js";
import { formatVnpayDate, queryVnpayTransaction } from "../utils/vnpayQuery.js";
import { PaymentAttempt } from "../models/paymentAttemptModel.js";
import { startVnpayAttempt } from "../services/startVnpayAttempt.js";
import { Product } from "../models/productsModel.js";
import { Special } from "../models/specialModel.js";

const vnpayEncode = (value) =>
  encodeURIComponent(String(value))
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const parseVnpayDate = (value) => {
  if (!/^\d{14}$/.test(String(value))) return undefined;
  const text = String(value);
  const parsed = new Date(
    Number(text.slice(0, 4)),
    Number(text.slice(4, 6)) - 1,
    Number(text.slice(6, 8)),
    Number(text.slice(8, 10)),
    Number(text.slice(10, 12)),
    Number(text.slice(12, 14)),
  );
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const verifyCallback = (query) => {
  const params = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
  const secureHash = params.vnp_SecureHash;
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  if (!secureHash || !process.env.VNP_HASH_SECRET) {
    return { valid: false, params };
  }

  const signData = Object.keys(params)
    .sort()
    .map((key) => `${vnpayEncode(key)}=${vnpayEncode(params[key])}`)
    .join("&");
  const calculatedHash = crypto
    .createHmac("sha512", process.env.VNP_HASH_SECRET)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  const received = Buffer.from(secureHash.toLowerCase(), "utf8");
  const calculated = Buffer.from(calculatedHash.toLowerCase(), "utf8");
  const valid =
    received.length === calculated.length &&
    crypto.timingSafeEqual(received, calculated);
  return { valid, params };
};

const confirmPayment = async (params, io) => {
  const paymentRef = params.vnp_TxnRef?.trim();
  const attempt = await PaymentAttempt.findOne({ attemptRef: paymentRef });
  const order = attempt
    ? await Order.findById(attempt.orderId)
    : mongoose.isValidObjectId(paymentRef)
      ? await Order.findById(paymentRef)
      : null;
  if (!order) return { rspCode: "01", message: "Order not found" };

  const paidAmount = Number(params.vnp_Amount) / 100;
  if (!Number.isFinite(paidAmount) || paidAmount !== order.totalPrice) {
    return { rspCode: "04", message: "Invalid amount" };
  }
  if (process.env.VNP_TMN_CODE && params.vnp_TmnCode !== process.env.VNP_TMN_CODE) {
    return { rspCode: "97", message: "Invalid merchant" };
  }

  if (order.paymentStatus === "paid") {
    return {
      rspCode: "00",
      message: "Payment already confirmed",
      order,
      alreadyProcessed: true,
    };
  }
  if (!["pending", "checking"].includes(order.paymentStatus) || order.inventoryReleasedAt) {
    return {
      rspCode: "02",
      message: "Order is no longer payable",
      order,
    };
  }

  const paymentSucceeded =
    params.vnp_ResponseCode === "00" &&
    (!params.vnp_TransactionStatus || params.vnp_TransactionStatus === "00");
  if (!paymentSucceeded) {
    if (attempt && order.currentPaymentRef !== attempt.attemptRef) {
      await PaymentAttempt.updateOne(
        { _id: attempt._id, status: "pending" },
        {
          status: params.vnp_ResponseCode === "24" ? "cancelled" : "failed",
          responseCode: params.vnp_ResponseCode,
          rawResponse: params,
        },
      );
      return {
        rspCode: "00",
        message: "Stale payment attempt ignored",
        order,
      };
    }
    await releasePendingOrderInventory(
      order._id,
      `vnpay_${params.vnp_ResponseCode || "unknown"}`,
      { io },
    );
    return {
      rspCode: "00",
      message: "Payment failure recorded",
      order: await Order.findById(order._id),
    };
  }

  const session = await mongoose.startSession();
  let updatedOrder;
  try {
    await session.withTransaction(async () => {
      if (order.couponCode) {
        const coupon = await Coupons.findOne({ code: order.couponCode }).session(session);
        if (coupon) {
          const couponUpdate = await Coupons.updateOne(
            { _id: coupon._id, usedCount: { $lt: coupon.usageLimit } },
            { $inc: { usedCount: 1 } },
            { session },
          );
          if (couponUpdate.modifiedCount !== 1) {
            throw new Error("Coupon usage limit reached");
          }
          await UserCoupon.updateOne(
            { userId: order.userId, couponId: coupon._id },
            { $set: { isUsed: true, usedAt: new Date() } },
            { session },
          );
        }
      }

      updatedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          paymentStatus: { $in: ["pending", "checking"] },
          inventoryReleasedAt: null,
        },
        {
          paymentStatus: "paid",
          paidAt: parseVnpayDate(params.vnp_PayDate) || new Date(),
          soldCountCommitted: true,
        },
        { returnDocument: "after", session },
      );
      if (!updatedOrder) throw new Error("Order already processed");

      if (!order.soldCountCommitted) {
        const paidItems = await OrderItem.find({ orderId: order._id }).session(session);
        for (const item of paidItems) {
          const ItemModel = item.itemType === "Special" ? Special : Product;
          const soldUpdate = await ItemModel.updateOne(
            { _id: item.productId },
            { $inc: { soldCount: item.quantity } },
            { session },
          );
          if (soldUpdate.modifiedCount !== 1) {
            throw new Error(`Không thể cập nhật số lượng bán của ${item.productId}`);
          }
        }
      }

      await Transaction.findOneAndUpdate(
        { orderId: order._id },
        {
          status: "completed",
          gatewayDetails: {
            transactionId: params.vnp_TransactionNo,
            responseCode: params.vnp_ResponseCode,
            bankCode: params.vnp_BankCode,
            payDate: parseVnpayDate(params.vnp_PayDate),
            rawPayDate: params.vnp_PayDate,
            rawLog: params,
          },
        },
        { session },
      );
      if (attempt) {
        await PaymentAttempt.updateOne(
          { _id: attempt._id, status: "pending" },
          {
            status: "completed",
            gatewayTransactionId: params.vnp_TransactionNo,
            responseCode: params.vnp_ResponseCode,
            rawResponse: params,
          },
          { session },
        );
        await PaymentAttempt.updateMany(
          {
            orderId: order._id,
            _id: { $ne: attempt._id },
            status: "pending",
          },
          { $set: { status: "cancelled", responseCode: "superseded_by_success" } },
          { session },
        );
      }

      if (order.source === "cart") {
        const cart = await Cart.findOne({ userId: order.userId }).session(session);
        if (cart) {
          const paidItems = await OrderItem.find({ orderId: order._id })
            .select("productId")
            .session(session);
          await CartItems.deleteMany(
            {
              cartId: cart._id,
              productId: { $in: paidItems.map((item) => item.productId) },
            },
            { session },
          );
        }
      }
    });
  } catch (error) {
    const latestOrder = await Order.findById(order._id);
    if (latestOrder?.paymentStatus === "paid") {
      return {
        rspCode: "00",
        message: "Payment already confirmed",
        order: latestOrder,
        alreadyProcessed: true,
      };
    }
    throw error;
  } finally {
    await session.endSession();
  }

  emitOrderUpdated(io, updatedOrder);
  await sendInternalNotification(
    updatedOrder.userId,
    "Thanh toán VNPay thành công",
    `Đơn hàng #${String(updatedOrder._id).slice(-6).toUpperCase()} đã được thanh toán thành công.`,
    {
      orderId: updatedOrder._id,
      type: "order_paid",
      paymentStatus: "paid",
    },
    null,
    io,
  );

  return { rspCode: "00", message: "Success", order: updatedOrder };
};

export const confirmVerifiedVnpayPayment = confirmPayment;

const processCallback = async (query, io) => {
  const { valid, params } = verifyCallback(query);
  if (!valid) return { rspCode: "97", message: "Invalid signature" };
  return confirmPayment(params, io);
};

export const vnpayIPN = async (req, res) => {
  try {
    const result = await processCallback(req.query, req.app.get("io"));
    return res.status(200).json({
      RspCode: result.rspCode,
      Message: result.message,
    });
  } catch (error) {
    console.error("VNPay IPN error:", error);
    return res.status(200).json({ RspCode: "99", Message: "Internal Error" });
  }
};

export const confirmVnpayReturn = async (req, res) => {
  try {
    const result = await processCallback(req.query, req.app.get("io"));
    const confirmed = result.rspCode === "00" && result.order?.paymentStatus === "paid";
    return res.status(confirmed ? 200 : 400).json({
      success: confirmed,
      message: result.message,
      data: result.order
        ? {
            orderId: result.order._id,
            orderStatus: result.order.status,
            paymentStatus: result.order.paymentStatus,
          }
        : null,
    });
  } catch (error) {
    console.error("VNPay return confirmation error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xác minh kết quả thanh toán",
    });
  }
};

export const reconcileVnpayPayment = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.user.id,
      paymentMethod: "vnpay",
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn VNPay" });
    }
    if (order.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "Giao dịch đã được xác nhận trước đó",
        data: {
          orderId: order._id,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
        },
      });
    }

    const queryResult = await queryVnpayTransaction({
      orderId: order.currentPaymentRef || order._id,
      transactionDate: order.paymentRequestDate || formatVnpayDate(order.createdAt),
      ipAddress: req.ip,
    });
    if (
      queryResult.vnp_ResponseCode !== "00" ||
      queryResult.vnp_TransactionStatus !== "00"
    ) {
      return res.status(409).json({
        success: false,
        message: queryResult.vnp_Message || "VNPay chưa xác nhận giao dịch thành công",
      });
    }

    const result = await confirmPayment(queryResult, req.app.get("io"));
    const confirmed = result.order?.paymentStatus === "paid";
    return res.status(confirmed ? 200 : 409).json({
      success: confirmed,
      message: result.message,
      data: result.order
        ? {
            orderId: result.order._id,
            orderStatus: result.order.status,
            paymentStatus: result.order.paymentStatus,
          }
        : null,
    });
  } catch (error) {
    console.error("VNPay reconciliation error:", error);
    return res.status(502).json({
      success: false,
      message: "Không thể đối soát giao dịch với VNPay",
    });
  }
};

export const resumeVnpayPayment = async (req, res) => {
  try {
    let order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.user.id,
      paymentMethod: "vnpay",
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng thanh toán VNPay",
      });
    }
    if (order.paymentStatus === "paid") {
      return res.status(409).json({
        success: false,
        message: "Đơn hàng đã được thanh toán",
        data: { paymentStatus: order.paymentStatus },
      });
    }
    if (
      order.status === "payment_failed" &&
      order.inventoryReleasedAt &&
      ["failed", "cancelled"].includes(order.paymentStatus)
    ) {
      const reserveSession = await mongoose.startSession();
      try {
        await reserveSession.withTransaction(async () => {
          const reservableOrder = await Order.findOne({
            _id: order._id,
            userId: req.user.id,
            status: "payment_failed",
            inventoryReleasedAt: { $ne: null },
          }).session(reserveSession);
          if (!reservableOrder) {
            const error = new Error("Đơn hàng đang được xử lý bởi yêu cầu khác");
            error.statusCode = 409;
            throw error;
          }
          const items = await OrderItem.find({ orderId: order._id }).session(reserveSession);
          for (const item of items) {
            const ItemModel = item.itemType === "Special" ? Special : Product;
            const reserved = await ItemModel.updateOne(
              { _id: item.productId, stock: { $gte: item.quantity }, isActive: true },
              { $inc: { stock: -item.quantity } },
              { session: reserveSession },
            );
            if (reserved.modifiedCount !== 1) {
              const error = new Error(`${item.productName} không còn đủ tồn kho`);
              error.statusCode = 409;
              error.errorCode = "INSUFFICIENT_STOCK";
              throw error;
            }
          }
          reservableOrder.status = "pending";
          reservableOrder.paymentStatus = "pending";
          reservableOrder.inventoryReleasedAt = null;
          reservableOrder.paymentCheckAttempts = 0;
          reservableOrder.cancelReason = undefined;
          await reservableOrder.save({ session: reserveSession });
        });
      } finally {
        await reserveSession.endSession();
      }
      order = await Order.findById(order._id);
    }
    if (
      !["pending", "checking"].includes(order.paymentStatus) ||
      order.status === "cancelled" ||
      order.inventoryReleasedAt
    ) {
      return res.status(409).json({
        success: false,
        message: "Đơn hàng không còn đủ điều kiện tiếp tục thanh toán",
        data: { paymentStatus: order.paymentStatus },
      });
    }

    try {
      const queryResult = await queryVnpayTransaction({
        orderId: order.currentPaymentRef || order._id,
        transactionDate:
          order.paymentRequestDate || formatVnpayDate(order.createdAt),
        ipAddress: req.ip,
      });
      if (
        queryResult.vnp_ResponseCode === "00" &&
        queryResult.vnp_TransactionStatus === "00"
      ) {
        const confirmed = await confirmPayment(
          queryResult,
          req.app.get("io"),
        );
        return res.status(200).json({
          success: true,
          message: "Giao dịch đã được thanh toán trước đó",
          data: {
            orderId: order._id,
            paymentStatus: confirmed.order?.paymentStatus || "paid",
          },
        });
      }
    } catch (error) {
      // A new payment URL is still safe when VNPay has no successful transaction.
      console.warn("VNPay resume reconciliation skipped:", error.message);
    }

    const platform = req.body?.platform === "mobile" ? "mobile" : "web";
    const payment = await startVnpayAttempt({
      order,
      userId: req.user.id,
      ip: req.ip,
      platform,
    });

    return res.status(200).json({
      success: true,
      message: "Đã khởi tạo lại phiên thanh toán VNPay",
      data: {
        orderId: order._id,
        paymentStatus: "pending",
        paymentUrl: payment.paymentUrl,
        paymentExpiresAt: payment.paymentExpiresAt,
      },
    });
  } catch (error) {
    console.error("VNPay resume error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.errorCode,
      message: error.message || "Không thể tiếp tục thanh toán VNPay",
    });
  }
};

export const abandonVnpayPayment = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.user.id,
      paymentMethod: "vnpay",
    }).select("_id paymentStatus currentPaymentRef paymentRequestDate createdAt");
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn VNPay" });
    }
    if (!["pending", "checking"].includes(order.paymentStatus)) {
      return res.status(200).json({
        success: true,
        message: "Đơn hàng đã được xử lý trước đó",
        data: { paymentStatus: order.paymentStatus },
      });
    }

    try {
      const queryResult = await queryVnpayTransaction({
        orderId: order.currentPaymentRef || order._id,
        transactionDate: order.paymentRequestDate || formatVnpayDate(order.createdAt),
        ipAddress: req.ip,
      });
      if (
        queryResult.vnp_ResponseCode === "00" &&
        queryResult.vnp_TransactionStatus === "00"
      ) {
        const confirmed = await confirmPayment(queryResult, req.app.get("io"));
        return res.status(200).json({
          success: true,
          message: "Giao dịch đã thanh toán và được xác nhận",
          data: { paymentStatus: confirmed.order?.paymentStatus || "paid" },
        });
      }
    } catch (error) {
      return res.status(409).json({
        success: false,
        message: "Chưa thể kết luận trạng thái VNPay, hệ thống sẽ tự đối soát lại",
      });
    }

    const released = await releasePendingOrderInventory(
      order._id,
      "payment_abandoned",
      { io: req.app.get("io") },
    );
    return res.status(200).json({
      success: true,
      message: "Đã hủy phiên thanh toán",
      data: { paymentStatus: released?.paymentStatus || "pending" },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
