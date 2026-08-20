import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { getMe, updatePushToken } from "../controller/userController.js"
import { trackView } from "../controller/productController.js"
import { validate } from "../middleware/validate.js"
import { categoryViewSchema } from "../validation/schemas.js"
const router = express.Router()

router.get("/me", protectRoute, getMe)
router.post("/view-history", protectRoute, validate(categoryViewSchema), trackView)
router.post("/push-token", protectRoute, updatePushToken)
export default router
