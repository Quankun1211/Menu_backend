import express from "express"
import { applyCoupon, createCoupon } from "../controller/couponsController.js"
import { protectRoute } from "../middleware/protectRoute.js"

const router = express.Router()

router.post("/create", createCoupon)
router.post("/apply", protectRoute, applyCoupon)

export default router