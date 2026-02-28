import express from "express"
import upload from "../middleware/upload.js"
import { createSpecialProduct, getProductsSpecialByRegion } from "../controller/specialController.js"
const router = express.Router()

router.post("/create", upload.single("images"), createSpecialProduct)
router.get("/get", getProductsSpecialByRegion)

export default router