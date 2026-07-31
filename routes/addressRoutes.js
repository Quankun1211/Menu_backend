import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { addAddress, deleteAddress, getAddressById, getAddresses, setDefaultAddress, updateAddress } from "../controller/addressController.js"
import { validate } from "../middleware/validate.js"
import { addressSchema, addressUpdateSchema, objectIdParams } from "../validation/schemas.js"
const router = express.Router()

router.post("/", protectRoute, validate(addressSchema), addAddress)
router.get("/", protectRoute, getAddresses)
router.get("/:addressId", protectRoute, validate(objectIdParams("addressId"), "params"), getAddressById)
router.put("/:addressId", protectRoute, validate(objectIdParams("addressId"), "params"), validate(addressUpdateSchema), updateAddress)
router.put("/:addressId/default", protectRoute, validate(objectIdParams("addressId"), "params"), setDefaultAddress)
router.delete("/:addressId", protectRoute, validate(objectIdParams("addressId"), "params"), deleteAddress)

export default router
