import express from "express"
import { applyCoupon, createCoupon } from "../controller/couponsController.js"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import { couponApplySchema, couponCreateSchema } from "../validation/schemas.js"

const router = express.Router()

router.post("/", protectRoute, authorizeRole(["admin", "super_admin"]), validate(couponCreateSchema), createCoupon)
router.post("/validation", protectRoute, validate(couponApplySchema), applyCoupon)

export default router
