import express from "express"
import { addToCart, getCart, removeItemsFromCart, updateCartItemQuantity } from "../controller/cartController.js"
import { protectRoute } from "../middleware/protectRoute.js"

const router = express.Router()

router.post("/add-to-cart", protectRoute, addToCart)
router.get("/get-cart", protectRoute, getCart)
router.post("/remove-cart", protectRoute, removeItemsFromCart)
router.post("/update-quantity", protectRoute, updateCartItemQuantity)

export default router