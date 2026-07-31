import express from "express";
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js";
import { trackBehavior } from "../utils/trackingUserBehavior.js";
import { createOrder, getMyOrders, getOrderDetail, vnpayReturn } from "../controller/orderController.js";
import { cancelOrder } from "../controller/orderCancellationController.js";
import {
  abandonVnpayPayment,
  confirmVnpayReturn,
  reconcileVnpayPayment,
  resumeVnpayPayment,
  vnpayIPN,
} from "../controller/vnpayCallbackController.js";
import { markOrderAsDelivered } from "../controller/walletController.js";
import { validate } from "../middleware/validate.js";
import { cancelOrderSchema, objectIdParams, orderSchema, paginationQuery } from "../validation/schemas.js";
import { distributedRateLimit } from "../middleware/security.js";

const router = express.Router();

router.post(
  "/",
  protectRoute,
  distributedRateLimit({ windowSeconds: 60, max: 10, prefix: "order:create" }),
  validate(orderSchema),
  createOrder,
);
router.get("/", protectRoute, validate(paginationQuery, "query"), getMyOrders);

router.get("/payment-callbacks/vnpay/return", vnpayReturn);
router.get("/payment-callbacks/vnpay/ipn", vnpayIPN);
router.get("/payment-confirmations/vnpay", confirmVnpayReturn);
router.post(
  "/:orderId/payment-reconciliations",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  reconcileVnpayPayment,
);
router.post(
  "/:orderId/payment-abandonments",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  abandonVnpayPayment,
);
router.post(
  "/:orderId/payment-attempts",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  resumeVnpayPayment,
);

router.get(
  "/:orderId",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  trackBehavior("view", "Order"),
  getOrderDetail,
);
router.patch(
  "/:orderId/cancellation",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  validate(cancelOrderSchema),
  trackBehavior("cancel", "Order"),
  cancelOrder,
);
router.patch(
  "/:orderId/delivery",
  protectRoute,
  authorizeRole(["shipper", "admin", "super_admin"]),
  validate(objectIdParams("orderId"), "params"),
  markOrderAsDelivered,
);

export default router;
