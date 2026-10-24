import { Order } from "../models/ordersModel.js";
import { User } from "../models/userModel.js";

const activeStatuses = ["assigned", "confirmed", "processing", "shipping", "pending_cancel"];

export const reserveShipperAssignmentCapacity = async ({ shipperId, maxActiveOrders, session }) => {
  // This write serializes concurrent assignment transactions for the same shipper.
  const lock = await User.updateOne(
    { _id: shipperId, role: "shipper", isActive: true, isOnline: true },
    { $inc: { assignmentLockVersion: 1 } },
    { session },
  );
  if (lock.matchedCount !== 1) {
    const error = new Error("Shipper không còn trực tuyến hoặc không khả dụng");
    error.statusCode = 409;
    error.code = "SHIPPER_UNAVAILABLE";
    throw error;
  }

  const activeOrders = await Order.countDocuments({
    shipperId,
    status: { $in: activeStatuses },
  }).session(session);
  if (activeOrders >= maxActiveOrders) {
    const error = new Error(`Shipper đã đạt giới hạn ${maxActiveOrders} đơn đang xử lý`);
    error.statusCode = 409;
    error.code = "SHIPPER_CAPACITY_REACHED";
    throw error;
  }
};
