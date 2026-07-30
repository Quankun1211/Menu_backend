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

// Static REST paths must be registered before the public /:id route.
router.get("/latest", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getLatestRecipeDetail)
router.get("/saved", validate(paginationQuery, "query"), optionalProtectRoute, getSavedRecipes)
router.get("/by-category", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_category", "Recipe"), getRecipesByCategory)
router.get("/categories", validate(paginationQuery, "query"), getCategoryRecipe)
router.get("/mine", protectRoute, validate(paginationQuery, "query"), getRecipes)
router.post("/mine", protectRoute, upload.single("image"), validate(catalogSchema), createUserRecipe)

router.get(["/get-detail/:id", "/:id"], validate(slugOrIdParams(), "params"), optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getRecipeDetail)
router.get(["/get-by-category", "/by-category"], validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_category", "Recipe"), getRecipesByCategory)
router.get(["/get-lastest", "/latest"], validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getLatestRecipeDetail)
router.get(["/saved-list", "/saved"], validate(paginationQuery, "query"), optionalProtectRoute, getSavedRecipes)

// Các route bắt buộc đăng nhập
router.post(["/save/:recipeId", "/:recipeId/saved-state"], protectRoute, validate(objectIdParams("recipeId"), "params"), trackBehavior("favourite", "Recipe"), toggleSaveRecipe)
router.get(["/get-my-recipe-detail/:recipeId", "/mine/:recipeId"], protectRoute, validate(objectIdParams("recipeId"), "params"), trackBehavior("view_recipe", "Recipe"), getMyRecipeDetail)
router.post(["/create-my-recipes", "/mine"], protectRoute, upload.single("image"), validate(catalogSchema), createUserRecipe)
router.get(["/get-my-recipes", "/mine"], protectRoute, validate(paginationQuery, "query"), getRecipes)
router.put(["/update-my-recipe/:recipeId", "/mine/:recipeId"], protectRoute, validate(objectIdParams("recipeId"), "params"), upload.single("image"), validate(catalogSchema), updateUserRecipe)
router.delete(["/delete-my-recipe/:recipeId", "/mine/:recipeId"], protectRoute, validate(objectIdParams("recipeId"), "params"), deleteUserRecipe)

// Các route quản trị (Admin/Postman)
router.post("/create", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createRecipe)
router.post("/category/create", protectRoute, authorizeRole(["admin", "super_admin"]), validate(categorySchema), createCategoryRecipe)
router.get(["/category/get", "/categories"], validate(paginationQuery, "query"), getCategoryRecipe)
router.post("/create-postman", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createRecipePostman)
export default router
