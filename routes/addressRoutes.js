import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { addAddress, deleteAddress, getAddressById, getAddresses, setDefaultAddress, updateAddress } from "../controller/addressController.js"
import { validate } from "../middleware/validate.js"
import { addressSchema, addressUpdateSchema, objectIdParams } from "../validation/schemas.js"
const router = express.Router()

router.post("/add", protectRoute, validate(addressSchema), addAddress)
router.get("/get", protectRoute, getAddresses)
router.get("/get-detail/:addressId", protectRoute, validate(objectIdParams("addressId"), "params"), getAddressById)
router.put("/update/:addressId", protectRoute, validate(objectIdParams("addressId"), "params"), validate(addressUpdateSchema), updateAddress)
router.put("/default/:addressId", protectRoute, validate(objectIdParams("addressId"), "params"), setDefaultAddress)
router.delete("/remove/:addressId", protectRoute, validate(objectIdParams("addressId"), "params"), deleteAddress)

export default router
