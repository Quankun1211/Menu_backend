import express from "express"
import upload from "../middleware/upload.js"
import { getAllSalesAdmin, getSaleItems } from "../controller/saleController.js"
import { validate } from "../middleware/validate.js"
import { paginationQuery } from "../validation/schemas.js"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
const router = express.Router()

router.get("/get-item", validate(paginationQuery, "query"), getSaleItems)
router.get("/get-admin", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getAllSalesAdmin)

export default router
