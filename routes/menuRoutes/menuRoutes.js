import express from "express"
import upload from "../../middleware/upload.js"
import { createMenu, getMenuDetail, getMenus } from "../../controller/menuController/menuController.js"
import { trackBehavior } from "../../utils/trackingUserBehavior.js"
import { authorizeRole, optionalProtectRoute, protectRoute } from "../../middleware/protectRoute.js"
import { validate } from "../../middleware/validate.js"
import { catalogSchema, paginationQuery, slugOrIdParams } from "../../validation/schemas.js"
const router = express.Router()

router.get("/get-detail/:id", validate(slugOrIdParams(), "params"), optionalProtectRoute, trackBehavior("view", "Menu"), getMenuDetail)
router.post("/create", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createMenu)
router.get("/get", validate(paginationQuery, "query"), getMenus)
export default router
