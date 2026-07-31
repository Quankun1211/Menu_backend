import express from "express";
import { getMyCoupons, getMyWallet, claimMilestoneReward } from "../controller/walletController.js";
import { previewCheckout } from "../controller/productController.js";
import { getSavedRecipes, toggleSaveRecipe } from "../controller/menuController/recipeMenuController.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { validate } from "../middleware/validate.js";
import { checkoutPreviewSchema, objectIdParams, paginationQuery } from "../validation/schemas.js";

export const walletV1Routes = express.Router()
  .get("/me", protectRoute, getMyWallet)
  .post("/me/rewards", protectRoute, claimMilestoneReward);

export const currentUserV1Routes = express.Router()
  .get("/me/coupons", protectRoute, getMyCoupons)
  .get("/me/saved-recipes", protectRoute, validate(paginationQuery, "query"), getSavedRecipes)
  .patch(
    "/me/saved-recipes/:recipeId",
    protectRoute,
    validate(objectIdParams("recipeId"), "params"),
    toggleSaveRecipe,
  );

export const checkoutPreviewV1Routes = express.Router()
  .post("/", protectRoute, validate(checkoutPreviewSchema), previewCheckout);
