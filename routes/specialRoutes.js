import express from "express"
import upload from "../middleware/upload.js"
import { createSpecialProduct, getLatestSpecial, getProductsSpecialByRegion, getSpecialDetail } from "../controller/specialController.js"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import { catalogSchema, paginationQuery, slugOrIdParams } from "../validation/schemas.js"
const router = express.Router()

router.post("/create", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("images"), validate(catalogSchema), createSpecialProduct)
router.get(["/get", "/"], validate(paginationQuery, "query"), getProductsSpecialByRegion)
router.get("/latest", validate(paginationQuery, "query"), getLatestSpecial)
router.get("/:id", validate(slugOrIdParams(), "params"), getSpecialDetail)

export default router
