import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { addToFavourite, getFavourite, removeItemsFromFavourite } from "../controller/favouriteController.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
const router = express.Router()

router.post("/add-to-favourite", protectRoute, trackBehavior("favourite", "Product"), addToFavourite)
router.post("/remove-favourite", protectRoute, trackBehavior("unfavourite", "Product"), removeItemsFromFavourite)
router.get("/get-favourite", protectRoute, getFavourite)

export default router