import express from "express"
import { approveCancelOrder, assignOrderToShipper } from "../controller/adminController.js"
const router = express.Router()

router.post("/assign-order", assignOrderToShipper)
router.post("/approve-order-cancelled", approveCancelOrder)

export default router