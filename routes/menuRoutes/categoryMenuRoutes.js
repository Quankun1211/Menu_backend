import express from "express"
import upload from "../../middleware/upload.js"
import { createCategoryMenu, getCategoryMenu } from "../../controller/menuController/categoryMenuController.js"
import { authorizeRole, protectRoute } from "../../middleware/protectRoute.js"
import { validate } from "../../middleware/validate.js"
import { categorySchema, paginationQuery } from "../../validation/schemas.js"
const router = express.Router()

router.post("/create", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("images"), validate(categorySchema), createCategoryMenu)
router.get(["/get", "/"], validate(paginationQuery, "query"), getCategoryMenu)

export default router
