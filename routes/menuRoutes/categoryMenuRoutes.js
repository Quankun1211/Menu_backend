import express from "express"
import upload from "../../middleware/upload.js"
import { createCategoryMenu, getCategoryMenu } from "../../controller/menuController/categoryMenuController.js"
const router = express.Router()

router.post("/create", upload.single("images"), createCategoryMenu)
router.get("/get", getCategoryMenu)

export default router