import express from "express";
import { getAllIngredient, getIngredientById, getSystemIngredients } from "../../controller/menuController/ingredientController.js";
import { validate } from "../../middleware/validate.js";
import { objectIdParams, paginationQuery } from "../../validation/schemas.js";

const router = express.Router();

router.get("/", validate(paginationQuery, "query"), getAllIngredient);
router.get("/system", validate(paginationQuery, "query"), getSystemIngredients);
router.get("/:ingredientId", validate(objectIdParams("ingredientId"), "params"), getIngredientById);

export default router;
