import express from "express"
import { createCategories, getCategories } from "../controller/categoryController.js"
import upload from "../middleware/upload.js"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import { categorySchema, paginationQuery } from "../validation/schemas.js"
const router = express.Router()

router.post("/create", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("images"), validate(categorySchema), createCategories)
router.get("/get", validate(paginationQuery, "query"), getCategories)

export default router
