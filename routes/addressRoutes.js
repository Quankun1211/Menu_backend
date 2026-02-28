import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { addAddress, deleteAddress, getAddressById, getAddresses, setDefaultAddress, updateAddress } from "../controller/addressController.js"
const router = express.Router()

router.post("/add", protectRoute, addAddress)
router.get("/get", protectRoute, getAddresses)
router.get("/get-detail/:addressId", protectRoute, getAddressById)
router.put("/update/:addressId", protectRoute, updateAddress)
router.put("/default/:addressId", protectRoute, setDefaultAddress)
router.delete("/remove/:addressId", protectRoute ,deleteAddress)

export default router