import express from "express"
import upload from "../middleware/upload.js"
import { protectRoute, authorizeRole } from "../middleware/protectRoute.js"
import { approveCancelOrder, assignOrderToShipper, createCategory, createIngredient, createMenu, createProduct, createRecipeAdmin, createSale, deleteCategory, deleteIngredient, deleteMenu, deleteProductAdmin, deleteRecipeAdmin, deleteSale, deleteUser, getAdminAndShippers, getAllIngredientsAdmin, getAllMenus, getAllOrders, getAllRecipesAdmin, getAllSalesAdmin, getCategories, getMenuById, getProductDetailAdmin, getProducts, getRecipeByIdAdmin, getSaleItems, getSpecials, processCancelOrder, registerUser, updateCategory, updateIngredient, updateMenu, updateProductAdmin, updateRecipeAdmin, updateSale, updateUser } from "../controller/adminController.js"
const router = express.Router()

// Get
router.get("/users-get", protectRoute, authorizeRole(["admin", "super_admin"]), getAdminAndShippers);
router.get("/get-all-orders", protectRoute, authorizeRole(["admin", "super_admin"]), getAllOrders);
router.get("/get-all-products", protectRoute, authorizeRole(["admin", "super_admin"]), getProducts);
router.get("/get-all-category", protectRoute, authorizeRole(["admin", "super_admin"]), getCategories);
router.get("/get-all-specials", protectRoute, authorizeRole(["admin", "super_admin"]), getSpecials);
router.get("/get-all-recipes", protectRoute, authorizeRole(["admin", "super_admin"]), getAllRecipesAdmin);
router.get("/get-all-ingredients", protectRoute, authorizeRole(["admin", "super_admin"]), getAllIngredientsAdmin);
router.get("/get-all-menus", protectRoute, authorizeRole(["admin", "super_admin"]), getAllMenus);
router.get("/get-all-sales", protectRoute, authorizeRole(["admin", "super_admin"]), getSaleItems);
router.get("/get-sales", protectRoute, authorizeRole(["admin", "super_admin"]), getAllSalesAdmin);
router.get("/get-product-detail/:id", protectRoute, authorizeRole(["admin", "super_admin"]), getProductDetailAdmin);
router.get("/get-recipe-detail/:id", protectRoute, authorizeRole(["admin", "super_admin"]), getRecipeByIdAdmin);
router.get("/get-menu-detail/:id", protectRoute, authorizeRole(["admin", "super_admin"]), getMenuById);

// Create
router.post("/create-user", protectRoute, authorizeRole(["admin", "super_admin"]), registerUser)
router.post("/create-category", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), createCategory)
router.post("/create-product", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), createProduct)
router.post("/create-sale", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), createSale)
router.post("/create-ingredient", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), createIngredient)
router.post("/create-recipe", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), createRecipeAdmin)
router.post("/create-menu", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), createMenu)

// Update
router.patch("/users-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), updateUser);
router.put("/category-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), updateCategory);
router.put("/product-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), updateProductAdmin);
router.put("/sale-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), updateSale);
router.put("/ingredient-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), updateIngredient);
router.put("/recipe-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), updateRecipeAdmin);
router.put("/menu-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), updateMenu);

// Delete
router.delete("/users-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteUser);
router.delete("/category-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteCategory);
router.delete("/product-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteProductAdmin);
router.delete("/sale-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteSale);
router.delete("/ingredient-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteIngredient);
router.delete("/recipe-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteRecipeAdmin);
router.delete("/menu-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), deleteMenu);

// Admin role
router.patch("/process-cancel", protectRoute, processCancelOrder);
router.post("/assign-order", assignOrderToShipper)
router.post("/approve-order-cancelled", approveCancelOrder)

export default router