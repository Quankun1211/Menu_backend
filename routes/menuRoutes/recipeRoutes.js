import express from "express"
import upload from "../../middleware/upload.js"
import { createRecipe, createRecipePostman, getLatestRecipeDetail, getRecipeDetail, getRecipesByCategory, toggleSaveRecipe, getSavedRecipes } from "../../controller/menuController/recipeMenuController.js"
import { createCategoryRecipe, getCategoryRecipe } from "../../controller/menuController/categoryMenuController.js"
import { authorizeRole, protectRoute, optionalProtectRoute } from "../../middleware/protectRoute.js"
import { createUserRecipe, getRecipes, getMyRecipeDetail, updateUserRecipe, deleteUserRecipe } from "../../controller/menuController/userRecipeController.js"
import {trackBehavior} from "../../utils/trackingUserBehavior.js"
import { validate } from "../../middleware/validate.js"
import { catalogSchema, categorySchema, objectIdParams, paginationQuery, slugOrIdParams } from "../../validation/schemas.js"
const router = express.Router()

router.get("/get-detail/:id", validate(slugOrIdParams(), "params"), optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getRecipeDetail)
router.get("/get-by-category", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_category", "Recipe"), getRecipesByCategory)
router.get("/get-lastest", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getLatestRecipeDetail)
router.get("/saved-list", validate(paginationQuery, "query"), optionalProtectRoute, getSavedRecipes)

// Các route bắt buộc đăng nhập
router.post("/save/:recipeId", protectRoute, validate(objectIdParams("recipeId"), "params"), trackBehavior("favourite", "Recipe"), toggleSaveRecipe)
router.get("/get-my-recipe-detail/:recipeId", protectRoute, validate(objectIdParams("recipeId"), "params"), trackBehavior("view_recipe", "Recipe"), getMyRecipeDetail)
router.post("/create-my-recipes", protectRoute, upload.single("image"), validate(catalogSchema), createUserRecipe)
router.get("/get-my-recipes", protectRoute, validate(paginationQuery, "query"), getRecipes)
router.put("/update-my-recipe/:recipeId", protectRoute, validate(objectIdParams("recipeId"), "params"), upload.single("image"), validate(catalogSchema), updateUserRecipe)
router.delete("/delete-my-recipe/:recipeId", protectRoute, validate(objectIdParams("recipeId"), "params"), deleteUserRecipe)

// Các route quản trị (Admin/Postman)
router.post("/create", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createRecipe)
router.post("/category/create", protectRoute, authorizeRole(["admin", "super_admin"]), validate(categorySchema), createCategoryRecipe)
router.get("/category/get", validate(paginationQuery, "query"), getCategoryRecipe)
router.post("/create-postman", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createRecipePostman)
export default router
