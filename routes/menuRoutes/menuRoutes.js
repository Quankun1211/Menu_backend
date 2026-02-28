import express from "express"
import upload from "../../middleware/upload.js"
import { createMenu, getMenuDetail, getMenus } from "../../controller/menuController/menuController.js"
const router = express.Router()

router.post("/create", upload.single("image"), createMenu)
// router.post("/create-postman", upload.single("image"), createRecipePostman )
router.get("/get", getMenus)
router.get("/get-detail/:id", getMenuDetail)

export default router