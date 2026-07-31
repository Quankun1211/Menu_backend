import express from "express";
import upload from "../middleware/upload.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { trackBehavior } from "../utils/trackingUserBehavior.js";
import { validate } from "../middleware/validate.js";
import { catalogSchema, objectIdParams, paginationQuery } from "../validation/schemas.js";
import {
  createUserRecipe,
  deleteUserRecipe,
  getMyRecipeDetail,
  getRecipes,
  updateUserRecipe,
} from "../controller/menuController/userRecipeController.js";

const router = express.Router();

router.use(protectRoute);
router.get("/", validate(paginationQuery, "query"), getRecipes);
router.post("/", upload.single("image"), validate(catalogSchema), createUserRecipe);
router.get(
  "/:recipeId",
  validate(objectIdParams("recipeId"), "params"),
  trackBehavior("view_recipe", "Recipe"),
  getMyRecipeDetail,
);
router.put(
  "/:recipeId",
  validate(objectIdParams("recipeId"), "params"),
  upload.single("image"),
  validate(catalogSchema),
  updateUserRecipe,
);
router.delete("/:recipeId", validate(objectIdParams("recipeId"), "params"), deleteUserRecipe);

export default router;
