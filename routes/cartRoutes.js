import express from "express"
import { addToCart, getCart, removeItemsFromCart, updateCartItemQuantity } from "../controller/cartController.js"
import { protectRoute } from "../middleware/protectRoute.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
const router = express.Router()

router.post("/add-to-cart", protectRoute, trackBehavior("add_to_cart", "Product"), addToCart)
router.post("/update-quantity", protectRoute, trackBehavior("update_cart", "Product"), updateCartItemQuantity)
router.post("/remove-cart", protectRoute, trackBehavior("remove_from_cart", "Product"), removeItemsFromCart)
router.get("/get-cart", protectRoute, getCart)

export default router