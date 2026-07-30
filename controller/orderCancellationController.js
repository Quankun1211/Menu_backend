import mongoose from "mongoose";
import { Order } from "../models/ordersModel.js";
import { OrderItem } from "../models/orderItemsModel.js";
import { Product } from "../models/productsModel.js";
import { Special } from "../models/specialModel.js";
import { Coupons } from "../models/couponsModel.js";
import { UserCoupon } from "../models/userCouponModel.js";
import { Transaction } from "../models/transactionModel.js";
import { refundOrderLogic } from "../utils/vnpayRefund.js";
import { emitOrderUpdated } from "../utils/orderRealtime.js";
import { sendInternalNotification } from "./notificationController.js";

const CANCELABLE_STATUSES = ["pending", "confirmed", "processing"];

const restoreInventory = async (order, session) => {
  if (order.inventoryReleasedAt) return;

  const items = await OrderItem.find({ orderId: order._id }).session(session);
  for (const item of items) {
    const ItemModel = item.itemType === "Special" ? Special : Product;
    const restored = await ItemModel.updateOne(
      { _id: item.productId },
      {
        $inc: {
          stock: item.quantity,
          ...(order.soldCountCommitted && { soldCount: -item.quantity }),
        },
      },
      { session },
    );
    if (restored.matchedCount !== 1 || restored.modifiedCount !== 1) {
      throw new Error(`Không thể hoàn tồn kho sản phẩm ${item.productId}`);
    }
  }
  order.inventoryReleasedAt = new Date();
};

const restoreCoupon = async (order, originalPaymentStatus, session) => {
  const couponWasConsumed =
    Boolean(order.couponCode) &&
    (order.paymentMethod === "cod" || originalPaymentStatus === "paid" || order.totalPrice === 0);

  if (!couponWasConsumed) return;

  const coupon = await Coupons.findOne({ code: order.couponCode }).session(session);
  if (!coupon) return;

  await Coupons.updateOne(
    { _id: coupon._id, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
    { session },
  );
  await UserCoupon.updateOne(
    { userId: order.userId, couponId: coupon._id },
    { $set: { isUsed: false }, $unset: { usedAt: 1 } },
    { session },
  );
};

const claimVnpayRefund = async (orderId, userId) =>
  Order.findOneAndUpdate(
    {
      _id: orderId,
      userId,
      paymentMethod: "vnpay",
      paymentStatus: "paid",
      refundStatus: { $nin: ["processing", "gateway_completed", "completed"] },
    },
    { refundStatus: "processing", refundRequestedAt: new Date() },
    { new: true },
  );

export const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user.id;
  const reason = req.body.reason.trim();

  let initialOrder = await Order.findOne({ _id: orderId, userId });
  if (!initialOrder) {
    return res.status(404).json({ message: "Đơn hàng không tồn tại" });
  }
  if (!CANCELABLE_STATUSES.includes(initialOrder.status)) {
    return res.status(400).json({
      message: `Đơn hàng không thể hủy ở trạng thái ${initialOrder.status}`,
    });
  }

  const originalPaymentStatus = initialOrder.paymentStatus;
  let refundResult = null;

  if (
    initialOrder.paymentMethod === "vnpay" &&
    originalPaymentStatus === "paid" &&
    initialOrder.totalPrice > 0
  ) {
    initialOrder = await claimVnpayRefund(orderId, userId);
    if (!initialOrder) {
      return res.status(409).json({
        message: "Yêu cầu hoàn tiền của đơn hàng đang được xử lý hoặc đã hoàn tất",
      });
    }

    try {
      const transaction = await Transaction.findOne({ orderId });
      const transactionNo = transaction?.gatewayDetails?.transactionId;
      if (!transactionNo) {
        throw new Error("Không tìm thấy mã giao dịch VNPay để hoàn tiền");
      }

      refundResult = await refundOrderLogic({
        orderId,
        paymentRef: initialOrder.currentPaymentRef,
        amount: initialOrder.totalPrice,
        transactionDate:
          transaction.gatewayDetails?.rawPayDate ||
          initialOrder.paidAt ||
          initialOrder.createdAt,
        transactionNo,
        user: req.user.email || "user",
        ipAddress: req.ip,
      });

      if (refundResult?.vnp_ResponseCode !== "00") {
        throw new Error(
          `VNPay từ chối hoàn tiền: ${refundResult?.vnp_ResponseCode || "unknown"} - ` +
          `${refundResult?.vnp_Message || "Không có thông báo"}`,
        );
      }
      await Order.updateOne(
        { _id: orderId, refundStatus: "processing" },
        { refundStatus: "gateway_completed" },
      );
    } catch (error) {
      await Order.updateOne(
        { _id: orderId, refundStatus: "processing" },
        { refundStatus: "failed" },
      );
      return res.status(502).json({ message: error.message });
    }
  }

  const session = await mongoose.startSession();
  try {
    let cancelledOrder;
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, userId }).session(session);
      if (!order || !CANCELABLE_STATUSES.includes(order.status)) {
        const error = new Error("Trạng thái đơn hàng đã thay đổi, vui lòng tải lại");
        error.statusCode = 409;
        throw error;
      }
      if (order.paymentStatus !== originalPaymentStatus) {
        const error = new Error("Trạng thái thanh toán đã thay đổi, vui lòng tải lại");
        error.statusCode = 409;
        throw error;
      }

      await restoreInventory(order, session);
      await restoreCoupon(order, originalPaymentStatus, session);

      order.status = "cancelled";
      order.paymentStatus = originalPaymentStatus === "paid" ? "refunded" : "cancelled";
      order.cancelReason = reason;
      order.cancelledAt = new Date();
      order.cancelledBy = "user";
      if (originalPaymentStatus === "paid") {
        order.refundStatus = "completed";
        order.refundedAt = new Date();
      }

      await Transaction.updateOne(
        { orderId: order._id },
        {
          status: originalPaymentStatus === "paid" ? "refunded" : "cancelled",
          ...(refundResult && {
            "gatewayDetails.refundResponseCode": refundResult.vnp_ResponseCode,
            "gatewayDetails.refundTransactionNo": refundResult.vnp_TransactionNo,
            "gatewayDetails.refundedAt": new Date(),
          }),
        },
        { session },
      );
      await order.save({ session });
      cancelledOrder = order;
    });

    emitOrderUpdated(req.app.get("io"), cancelledOrder);
    const wasRefunded = originalPaymentStatus === "paid";
    await sendInternalNotification(
      userId,
      wasRefunded ? "Đã hủy đơn và hoàn tiền" : "Đã hủy đơn hàng",
      wasRefunded
        ? `Đơn hàng #${String(cancelledOrder._id).slice(-6).toUpperCase()} đã được hủy và yêu cầu hoàn tiền VNPay đã được tiếp nhận.`
        : `Đơn hàng #${String(cancelledOrder._id).slice(-6).toUpperCase()} đã được hủy thành công.`,
      {
        orderId: cancelledOrder._id,
        type: wasRefunded ? "order_refunded" : "order_cancelled",
        paymentStatus: cancelledOrder.paymentStatus,
      },
      null,
      req.app.get("io"),
    );
    return res.status(200).json({
      message: originalPaymentStatus === "paid"
        ? "Hủy đơn và gửi yêu cầu hoàn tiền thành công"
        : "Hủy đơn hàng thành công",
      data: cancelledOrder,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};

export const processShipperCancellation = async (req, res) => {
  const { orderId, action, adminNote = "" } = req.body;
  if (!["accept", "reject"].includes(action)) {
    return res.status(400).json({ success: false, message: "Hành động xử lý không hợp lệ" });
  }
  let initialOrder = await Order.findOne({ _id: orderId, status: "pending_cancel" });

  if (!initialOrder) {
    return res.status(400).json({
      success: false,
      message: "Đơn hàng không còn ở trạng thái chờ duyệt hủy",
    });
  }

  if (action === "reject") {
    initialOrder.status = "assigned";
    initialOrder.cancelRequest.isAccepted = false;
    initialOrder.cancelRequest.adminNote = adminNote;
    await initialOrder.save();
    emitOrderUpdated(req.app.get("io"), initialOrder);
    return res.status(200).json({ success: true, status: initialOrder.status });
  }

  const originalPaymentStatus = initialOrder.paymentStatus;
  let refundResult = null;

  if (
    initialOrder.paymentMethod === "vnpay" &&
    originalPaymentStatus === "paid" &&
    initialOrder.totalPrice > 0
  ) {
    initialOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: "pending_cancel",
        paymentStatus: "paid",
        refundStatus: { $nin: ["processing", "gateway_completed", "completed"] },
      },
      { refundStatus: "processing", refundRequestedAt: new Date() },
      { new: true },
    );
    if (!initialOrder) {
      return res.status(409).json({
        success: false,
        message: "Yêu cầu hoàn tiền đang được xử lý hoặc đã hoàn tất",
      });
    }

    try {
      const transaction = await Transaction.findOne({ orderId });
      const transactionNo = transaction?.gatewayDetails?.transactionId;
      if (!transactionNo) throw new Error("Không tìm thấy mã giao dịch VNPay để hoàn tiền");

      refundResult = await refundOrderLogic({
        orderId,
        paymentRef: initialOrder.currentPaymentRef,
        amount: initialOrder.totalPrice,
        transactionDate:
          transaction.gatewayDetails?.rawPayDate ||
          initialOrder.paidAt ||
          initialOrder.createdAt,
        transactionNo,
        user: req.user.email || "admin",
        ipAddress: req.ip,
      });
      if (refundResult?.vnp_ResponseCode !== "00") {
        throw new Error(
          `VNPay từ chối hoàn tiền: ${refundResult?.vnp_ResponseCode || "unknown"} - ` +
          `${refundResult?.vnp_Message || "Không có thông báo"}`,
        );
      }
      await Order.updateOne(
        { _id: orderId, refundStatus: "processing" },
        { refundStatus: "gateway_completed" },
      );
    } catch (error) {
      await Order.updateOne(
        { _id: orderId, refundStatus: "processing" },
        { refundStatus: "failed" },
      );
      return res.status(502).json({ success: false, message: error.message });
    }
  }

  const session = await mongoose.startSession();
  try {
    let cancelledOrder;
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, status: "pending_cancel" }).session(session);
      if (!order || order.paymentStatus !== originalPaymentStatus) {
        const error = new Error("Trạng thái đơn hàng hoặc thanh toán đã thay đổi");
        error.statusCode = 409;
        throw error;
      }

      await restoreInventory(order, session);
      await restoreCoupon(order, originalPaymentStatus, session);

      order.status = "cancelled";
      order.paymentStatus = originalPaymentStatus === "paid" ? "refunded" : "cancelled";
      order.cancelReason = order.cancelRequest?.reason || "Nhân viên giao hàng yêu cầu hủy";
      order.cancelRequest.isAccepted = true;
      order.cancelRequest.adminNote = adminNote;
      order.cancelledAt = new Date();
      order.cancelledBy = "admin";
      if (originalPaymentStatus === "paid") {
        order.refundStatus = "completed";
        order.refundedAt = new Date();
      }

      await Transaction.updateOne(
        { orderId },
        {
          status: originalPaymentStatus === "paid" ? "refunded" : "cancelled",
          ...(refundResult && {
            "gatewayDetails.refundResponseCode": refundResult.vnp_ResponseCode,
            "gatewayDetails.refundTransactionNo": refundResult.vnp_TransactionNo,
            "gatewayDetails.refundedAt": new Date(),
          }),
        },
        { session },
      );
      await order.save({ session });
      cancelledOrder = order;
    });

    const io = req.app.get("io");
    emitOrderUpdated(io, cancelledOrder);
    await sendInternalNotification(
      cancelledOrder.userId,
      originalPaymentStatus === "paid" ? "Đơn hàng đã hủy và hoàn tiền" : "Đơn hàng đã được hủy",
      originalPaymentStatus === "paid"
        ? `Yêu cầu hủy đơn #${String(cancelledOrder._id).slice(-6).toUpperCase()} đã được chấp nhận và hoàn tiền qua VNPay.`
        : `Yêu cầu hủy đơn #${String(cancelledOrder._id).slice(-6).toUpperCase()} đã được chấp nhận.`,
      {
        orderId: cancelledOrder._id,
        type: originalPaymentStatus === "paid" ? "order_refunded" : "order_cancelled",
        paymentStatus: cancelledOrder.paymentStatus,
      },
      null,
      io,
    );
    if (cancelledOrder.shipperId) {
      io.to(cancelledOrder.shipperId.toString()).emit("shipper_cancel_result", {
        orderId: cancelledOrder._id,
        status: cancelledOrder.status,
        message: "Yêu cầu hủy đơn đã được chấp nhận",
      });
    }
    io.to("admins").emit("admin_refresh_orders", { orderId: cancelledOrder._id });
    return res.status(200).json({ success: true, status: cancelledOrder.status });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

export const recoverGatewayCompletedRefunds = async (io = null) => {
  const orders = await Order.find({
    refundStatus: "gateway_completed",
    paymentStatus: "paid",
  }).select("_id").limit(100);

  for (const candidate of orders) {
    const session = await mongoose.startSession();
    let recoveredOrder;
    try {
      await session.withTransaction(async () => {
        const order = await Order.findOne({
          _id: candidate._id,
          refundStatus: "gateway_completed",
          paymentStatus: "paid",
        }).session(session);
        if (!order) return;

        await restoreInventory(order, session);
        await restoreCoupon(order, "paid", session);
        order.status = "cancelled";
        order.paymentStatus = "refunded";
        order.refundStatus = "completed";
        order.refundedAt = new Date();
        order.cancelledAt ||= new Date();
        order.cancelledBy ||= "system";
        order.cancelReason ||= "Khôi phục trạng thái sau khi VNPay đã hoàn tiền";
        await Transaction.updateOne(
          { orderId: order._id },
          { status: "refunded", "gatewayDetails.refundedAt": new Date() },
          { session },
        );
        await order.save({ session });
        recoveredOrder = order;
      });
      if (recoveredOrder) emitOrderUpdated(io, recoveredOrder);
    } finally {
      await session.endSession();
    }
  }
  return orders.length;
};
