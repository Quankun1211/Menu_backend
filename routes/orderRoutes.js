import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
import { cancelOrder, createOrder, getMyOrders, getOrderDetail, vnpayIPN, vnpayReturn } from "../controller/orderController.js"
import { claimMilestoneReward, getMyCoupons, getMyWallet, markOrderAsDelivered } from "../controller/walletController.js"
const router = express.Router()

router.post("/create", protectRoute, createOrder)
router.get("/get-detail/:orderId", protectRoute, trackBehavior("view", "Order"), getOrderDetail)
router.post("/cancel/:orderId", protectRoute, trackBehavior("cancel", "Order"), cancelOrder)
router.put("/delivered/:orderId", markOrderAsDelivered)
router.get("/wallet", protectRoute, getMyWallet); 
router.get("/my-coupon", protectRoute, getMyCoupons); 
router.post("/claim-reward", protectRoute, claimMilestoneReward); 
router.get("/vnpay-return", vnpayReturn); 
router.get("/vnpay-ipn", vnpayIPN);
router.get("/get", protectRoute, getMyOrders)

export default router