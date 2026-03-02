import express from "express"
import { protectRoute, authorizeRole } from "../middleware/protectRoute.js"
import { approveCancelOrder, assignOrderToShipper, deleteUser, getAdminAndShippers, getAllOrders, processCancelOrder, registerUser, updateUser } from "../controller/adminController.js"
const router = express.Router()

router.post("/create-user", protectRoute, authorizeRole(["admin", "super_admin"]), registerUser)
router.get("/users-get", protectRoute, authorizeRole(["admin", "super_admin"]), getAdminAndShippers);
router.get("/get-all-orders", protectRoute, authorizeRole(["admin", "super_admin"]), getAllOrders);
router.delete("/users-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteUser);
router.patch("/process-cancel", protectRoute, processCancelOrder);
router.patch("/users-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), updateUser);
router.post("/assign-order", assignOrderToShipper)
router.post("/approve-order-cancelled", approveCancelOrder)

export default router