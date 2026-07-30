export const ORDER_STATUSES = Object.freeze([
  "pending",
  "assigned",
  "confirmed",
  "processing",
  "shipping",
  "delivered",
  "completed",
  "pending_cancel",
  "payment_failed",
  "cancelled",
  "refunded",
]);

export const TERMINAL_ORDER_STATUSES = Object.freeze([
  "delivered",
  "completed",
  "cancelled",
  "refunded",
]);

const transitions = Object.freeze({
  pending: ["assigned", "cancelled", "completed"],
  assigned: ["confirmed", "pending_cancel", "cancelled"],
  confirmed: ["processing", "shipping", "pending_cancel", "cancelled"],
  processing: ["shipping", "cancelled"],
  shipping: ["delivered"],
  pending_cancel: ["assigned", "cancelled"],
  payment_failed: ["pending"],
  delivered: ["refunded"],
  completed: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
});

export const SHIPPER_TRANSITIONS = Object.freeze({
  assigned: ["confirmed"],
  confirmed: ["shipping"],
  processing: ["shipping"],
  shipping: ["delivered"],
});

export const canTransitionOrder = (currentStatus, nextStatus) =>
  Boolean(transitions[currentStatus]?.includes(nextStatus));

export const canShipperTransitionOrder = (currentStatus, nextStatus) =>
  Boolean(
    SHIPPER_TRANSITIONS[currentStatus]?.includes(nextStatus) &&
    canTransitionOrder(currentStatus, nextStatus),
  );

export const canRequestShipperCancellation = (status) =>
  status === "assigned" || status === "confirmed";

export const isTerminalOrderStatus = (status) =>
  TERMINAL_ORDER_STATUSES.includes(status);
