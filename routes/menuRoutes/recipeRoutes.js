import express from "express";
import {
  getLatestRecipeDetail,
  getRecipeDetail,
  getRecipesByCategory,
} from "../../controller/menuController/recipeMenuController.js";
import { getCategoryRecipe } from "../../controller/menuController/categoryMenuController.js";
import { optionalProtectRoute } from "../../middleware/protectRoute.js";
import { trackBehavior } from "../../utils/trackingUserBehavior.js";
import { validate } from "../../middleware/validate.js";
import { paginationQuery, slugOrIdParams } from "../../validation/schemas.js";

const router = express.Router();

const listRecipes = (req, res, next) => (
  req.query.view === "latest"
    ? getLatestRecipeDetail(req, res, next)
    : getRecipesByCategory(req, res, next)
);

router.get("/", validate(paginationQuery, "query"), optionalProtectRoute, listRecipes);
router.get("/categories", validate(paginationQuery, "query"), getCategoryRecipe);
router.get("/:id", validate(slugOrIdParams(), "params"), optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getRecipeDetail);

export default router;
