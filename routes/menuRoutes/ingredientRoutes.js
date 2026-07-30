import express from "express"
import upload from "../../middleware/upload.js"
import { createIngredient, getAllIngredient, getIngredientById, getSystemIngredients } from "../../controller/menuController/ingredientController.js"
import { authorizeRole, protectRoute } from "../../middleware/protectRoute.js"
import { validate } from "../../middleware/validate.js"
import { catalogSchema, objectIdParams, paginationQuery } from "../../validation/schemas.js"

const router = express.Router()

router.post("/create", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createIngredient)
router.get(["/get-all", "/"], validate(paginationQuery, "query"), getAllIngredient)
router.get(["/get-filter", "/system"], validate(paginationQuery, "query"), getSystemIngredients)
router.get(["/get/:ingredientId", "/:ingredientId"], validate(objectIdParams("ingredientId"), "params"), getIngredientById)

export default router
