import express from "express"
import { addToCart, getCart, removeItemsFromCart, updateCartItemQuantity } from "../controller/cartController.js"
import { protectRoute } from "../middleware/protectRoute.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
import { validate } from "../middleware/validate.js"
import { productIdSchema, productIdsSchema } from "../validation/schemas.js"
const router = express.Router()

router.post("/items", protectRoute, validate(productIdSchema), trackBehavior("add_to_cart", "Product"), addToCart)
router.patch("/items", protectRoute, validate(productIdSchema.required()), trackBehavior("update_cart", "Product"), updateCartItemQuantity)
router.delete("/items", protectRoute, validate(productIdsSchema), trackBehavior("remove_from_cart", "Product"), removeItemsFromCart)
router.get("/", protectRoute, getCart)

export default router
