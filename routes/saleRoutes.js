import express from "express"
import upload from "../middleware/upload.js"
import { getAllSalesAdmin, getSaleItems } from "../controller/saleController.js"
const router = express.Router()

router.get("/get-item" , getSaleItems)
router.get("/get-admin", getAllSalesAdmin)

export default router