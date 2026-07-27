import express from "express"
import { protectRoute } from "../middleware/protectRoute.js"
import { addToFavourite, getFavourite, removeItemsFromFavourite } from "../controller/favouriteController.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
import { validate } from "../middleware/validate.js"
import { paginationQuery, productIdSchema, productIdsSchema } from "../validation/schemas.js"
const router = express.Router()

router.post("/add-to-favourite", protectRoute, validate(productIdSchema.fork(["quantity"], (schema) => schema.forbidden())), trackBehavior("favourite", "Product"), addToFavourite)
router.post("/remove-favourite", protectRoute, validate(productIdsSchema), trackBehavior("unfavourite", "Product"), removeItemsFromFavourite)
router.get("/get-favourite", protectRoute, validate(paginationQuery, "query"), getFavourite)

export default router
