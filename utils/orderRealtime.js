export const emitOrderUpdated = (io, order, extra = {}) => {
  if (!io || !order?._id) return;

  const payload = {
    orderId: order._id.toString(),
    status: order.status,
    ...extra,
  };

  io.to("admins").emit("order_updated", payload);
  io.to(`order:${order._id}`).emit("order_updated", payload);
  if (order.userId) io.to(order.userId.toString()).emit("order_updated", payload);
  if (order.shipperId) {
    io.to(order.shipperId.toString()).emit("order_updated", payload);
    io.to(`shipper:${order.shipperId}`).emit("order_updated", payload);
  }
};
