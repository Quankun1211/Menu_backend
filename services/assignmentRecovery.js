import { Order } from "../models/ordersModel.js";
import { emitOrderUpdated } from "../utils/orderRealtime.js";
import { sendInternalNotification } from "../controller/notificationController.js";

export const releaseExpiredAssignments = async (io = null) => {
  const expired = await Order.find({
    status: "assigned",
    "assignment.expiresAt": { $lte: new Date() },
  }).limit(100);

  for (const order of expired) {
    const previousShipperId = order.shipperId;
    order.shipperId = null;
    order.status = "pending";
    order.assignment.previousShipperId = previousShipperId;
    order.assignment.expiresAt = undefined;
    order.assignment.reassignmentReason = "Shipper không xác nhận trong thời hạn";
    order.$locals.statusActor = {
      actorRole: "system",
      note: "Tự động thu hồi do quá hạn xác nhận",
    };
    await order.save();

    if (previousShipperId) {
      io?.to(previousShipperId.toString()).emit("order_unassigned", {
        orderId: order._id,
        reason: "assignment_expired",
      });
    }
    io?.to("admins").emit("admin_refresh_orders", { orderId: order._id });
    emitOrderUpdated(io, order, { assignmentExpired: true });
    await sendInternalNotification(
      order.userId,
      "Đơn hàng đang được điều phối lại",
      `Đơn #${String(order._id).slice(-6).toUpperCase()} đang được phân công lại cho nhân viên giao hàng khác.`,
      { orderId: order._id, type: "assignment_expired" },
      null,
      io,
    );
  }
  return expired.length;
};

export const startAssignmentRecovery = (io) => {
  const run = () =>
    releaseExpiredAssignments(io).catch((error) =>
      console.error("[assignment-recovery]", error.message),
    );
  run();
  const timer = setInterval(run, 60_000);
  timer.unref?.();
  return timer;
};
