import express from "express"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
import { createOrder, getMyOrders, getOrderDetail, vnpayReturn } from "../controller/orderController.js"
import { cancelOrder } from "../controller/orderCancellationController.js"
import { abandonVnpayPayment, confirmVnpayReturn, reconcileVnpayPayment, resumeVnpayPayment, vnpayIPN } from "../controller/vnpayCallbackController.js"
import { claimMilestoneReward, getMyCoupons, getMyWallet, markOrderAsDelivered } from "../controller/walletController.js"
import { validate } from "../middleware/validate.js"
import { cancelOrderSchema, objectIdParams, orderSchema, paginationQuery } from "../validation/schemas.js"
import { distributedRateLimit } from "../middleware/security.js"
const router = express.Router()

router.post(
  "/create",
  protectRoute,
  distributedRateLimit({ windowSeconds: 60, max: 10, prefix: "order:create" }),
  validate(orderSchema),
  createOrder,
)
router.get("/get-detail/:orderId", protectRoute, validate(objectIdParams("orderId"), "params"), trackBehavior("view", "Order"), getOrderDetail)
router.post("/cancel/:orderId", protectRoute, validate(objectIdParams("orderId"), "params"), validate(cancelOrderSchema), trackBehavior("cancel", "Order"), cancelOrder)
router.put("/delivered/:orderId", protectRoute, authorizeRole(["shipper", "admin", "super_admin"]), validate(objectIdParams("orderId"), "params"), markOrderAsDelivered)
router.get("/wallet", protectRoute, getMyWallet); 
router.get("/my-coupon", protectRoute, getMyCoupons); 
router.post("/claim-reward", protectRoute, claimMilestoneReward); 
router.get("/vnpay-return", vnpayReturn); 
router.get("/vnpay-ipn", vnpayIPN);
router.get("/vnpay-confirm", confirmVnpayReturn);
router.post(
  "/vnpay-reconcile/:orderId",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  reconcileVnpayPayment,
);
router.post(
  "/vnpay-abandon/:orderId",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  abandonVnpayPayment,
);
router.post(
  "/vnpay-resume/:orderId",
  protectRoute,
  validate(objectIdParams("orderId"), "params"),
  resumeVnpayPayment,
);
router.get("/get", protectRoute, validate(paginationQuery, "query"), getMyOrders)

export default router
