import express from "express"
import upload from "../../middleware/upload.js"
import { createRecipe, createRecipePostman, getLatestRecipeDetail, getRecipeDetail, getRecipesByCategory, toggleSaveRecipe, getSavedRecipes } from "../../controller/menuController/recipeMenuController.js"
import { createCategoryRecipe, getCategoryRecipe } from "../../controller/menuController/categoryMenuController.js"
import { protectRoute, optionalProtectRoute } from "../../middleware/protectRoute.js"
import { createUserRecipe, getRecipes, getMyRecipeDetail, updateUserRecipe, deleteUserRecipe } from "../../controller/menuController/userRecipeController.js"
import {trackBehavior} from "../../utils/trackingUserBehavior.js"
const router = express.Router()

router.get("/get-detail/:id", optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getRecipeDetail)
router.get("/get-by-category", optionalProtectRoute, trackBehavior("view_category", "Recipe"), getRecipesByCategory)
router.get("/get-lastest", optionalProtectRoute, trackBehavior("view_recipe", "Recipe"), getLatestRecipeDetail)
router.get("/saved-list", optionalProtectRoute, getSavedRecipes)

// Các route bắt buộc đăng nhập
router.post("/save/:recipeId", protectRoute, trackBehavior("favourite", "Recipe"), toggleSaveRecipe)
router.get("/get-my-recipe-detail/:recipeId", protectRoute, trackBehavior("view_recipe", "Recipe"), getMyRecipeDetail)
router.post("/create-my-recipes", protectRoute, upload.single("image"), createUserRecipe)
router.get("/get-my-recipes", protectRoute, getRecipes)
router.put("/update-my-recipe/:recipeId", protectRoute, upload.single("image"), updateUserRecipe)
router.delete("/delete-my-recipe/:recipeId", protectRoute, deleteUserRecipe)

// Các route quản trị (Admin/Postman)
router.post("/create", upload.single("image"), createRecipe)
router.post("/category/create", createCategoryRecipe)
router.get("/category/get", getCategoryRecipe)
router.post("/create-postman", upload.single("image"), createRecipePostman)
export default router