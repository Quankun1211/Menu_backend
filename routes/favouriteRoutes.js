import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { addToFavourite, getFavourite, removeItemsFromFavourite } from "../controller/favouriteController.js"

const router = express.Router()

router.post("/add-to-favourite", protectRoute, addToFavourite)
router.post("/remove-favourite", protectRoute, removeItemsFromFavourite)
router.get("/get-favourite", protectRoute, getFavourite)

export default router