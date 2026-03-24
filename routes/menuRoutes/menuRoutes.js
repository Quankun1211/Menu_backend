import express from "express"
import upload from "../../middleware/upload.js"
import { createMenu, getMenuDetail, getMenus } from "../../controller/menuController/menuController.js"
import { trackBehavior } from "../../utils/trackingUserBehavior.js"
import { optionalProtectRoute } from "../../middleware/protectRoute.js"
const router = express.Router()

router.get("/get-detail/:id", optionalProtectRoute, trackBehavior("view", "Menu"), getMenuDetail)
router.post("/create", upload.single("image"), createMenu)
router.get("/get", getMenus)
export default router