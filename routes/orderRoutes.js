import express from "express"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
import { cancelOrder, createOrder, getMyOrders, getOrderDetail, vnpayIPN, vnpayReturn } from "../controller/orderController.js"
import { claimMilestoneReward, getMyCoupons, getMyWallet, markOrderAsDelivered } from "../controller/walletController.js"
import { validate } from "../middleware/validate.js"
import { cancelOrderSchema, objectIdParams, orderSchema, paginationQuery } from "../validation/schemas.js"
const router = express.Router()

router.post("/create", protectRoute, validate(orderSchema), createOrder)
router.get("/get-detail/:orderId", protectRoute, validate(objectIdParams("orderId"), "params"), trackBehavior("view", "Order"), getOrderDetail)
router.post("/cancel/:orderId", protectRoute, validate(objectIdParams("orderId"), "params"), validate(cancelOrderSchema), trackBehavior("cancel", "Order"), cancelOrder)
router.put("/delivered/:orderId", protectRoute, authorizeRole(["shipper", "admin", "super_admin"]), validate(objectIdParams("orderId"), "params"), markOrderAsDelivered)
router.get("/wallet", protectRoute, getMyWallet); 
router.get("/my-coupon", protectRoute, getMyCoupons); 
router.post("/claim-reward", protectRoute, claimMilestoneReward); 
router.get("/vnpay-return", vnpayReturn); 
router.get("/vnpay-ipn", vnpayIPN);
router.get("/get", protectRoute, validate(paginationQuery, "query"), getMyOrders)

export default router
