import express from "express"
import upload from "../../middleware/upload.js"
import { createRecipe, createRecipePostman, getLatestRecipeDetail, getRecipeDetail, getRecipesByCategory, toggleSaveRecipe, getSavedRecipes } from "../../controller/menuController/recipeMenuController.js"
import { createCategoryRecipe, getCategoryRecipe } from "../../controller/menuController/categoryMenuController.js"
import { protectRoute } from "../../middleware/protectRoute.js"
import { createUserRecipe, getRecipes, getMyRecipeDetail, updateUserRecipe, deleteUserRecipe } from "../../controller/menuController/userRecipeController.js"

const router = express.Router()

router.post("/create", upload.single("image"), createRecipe)
router.post("/category/create", createCategoryRecipe)
router.get("/category/get", getCategoryRecipe)
router.post("/create-postman", upload.single("image"), createRecipePostman )
router.get("/get-detail/:id", getRecipeDetail)
router.get("/get-by-category", protectRoute, getRecipesByCategory)
router.get("/get-lastest", getLatestRecipeDetail)

// My recipe routes
router.post("/create-my-recipes", protectRoute, upload.single("image"), createUserRecipe)
router.get("/get-my-recipes", protectRoute, getRecipes)
router.get("/get-my-recipe-detail/:recipeId", protectRoute, getMyRecipeDetail)
router.put("/update-my-recipe/:recipeId", protectRoute, upload.single("image"), updateUserRecipe)
router.delete("/delete-my-recipe/:recipeId", protectRoute, deleteUserRecipe);
router.post("/save/:recipeId", protectRoute, toggleSaveRecipe);
router.get("/saved-list", protectRoute, getSavedRecipes);

export default router