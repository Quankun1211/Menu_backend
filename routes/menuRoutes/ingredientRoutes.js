import express from "express"
import upload from "../../middleware/upload.js"
import { createIngredient, getAllIngredient, getIngredientById, getSystemIngredients } from "../../controller/menuController/ingredientController.js"
import { protectRoute } from "../../middleware/protectRoute.js"

const router = express.Router()

router.post("/create", upload.single("image"), createIngredient)
router.get("/get-all", getAllIngredient)
router.get("/get-filter", getSystemIngredients)
router.get("/get/:ingredientId", getIngredientById)

export default router