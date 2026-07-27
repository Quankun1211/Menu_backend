import express from "express"
import { authorizeRole, protectRoute } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import { locationSchema, onlineSchema, shipperCancelSchema, shipperStatusSchema } from "../validation/schemas.js"
import { updateOrderStatus, getShipperOrders, requestCancelOrder, updateShipperStatus, getAllShipperOrders, updateShipperLocation } from "../controller/shipperController.js"
const router = express.Router()

router.use(protectRoute, authorizeRole(["shipper"]));
router.get("/orders", getShipperOrders)
router.get("/all-orders", getAllShipperOrders)
router.patch("/update", validate(shipperStatusSchema), updateOrderStatus);
router.post("/request-cancel", validate(shipperCancelSchema), requestCancelOrder);
router.put("/update-online", validate(onlineSchema), updateShipperStatus);
router.put("/update-location", validate(locationSchema), updateShipperLocation);

export default router
