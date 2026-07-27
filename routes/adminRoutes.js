import express from "express"
import upload from "../middleware/upload.js"
import { protectRoute, authorizeRole } from "../middleware/protectRoute.js"
import { validate } from "../middleware/validate.js"
import {
  adminCancelSchema,
  adminUserSchema,
  adminUserUpdateSchema,
  assignOrderSchema,
  catalogSchema,
  categorySchema,
  objectIdParams,
  paginationQuery,
  saleSchema,
} from "../validation/schemas.js"
import { approveCancelOrder, assignOrderToShipper, createCategory, createIngredient, createMenu, createProduct, createRecipeAdmin, createSale, deleteCategory, deleteIngredient, deleteMenu, deleteProductAdmin, deleteRecipeAdmin, deleteSale, deleteSpecialAdmin, deleteUser, getAdminAndShippers, getAllIngredientsAdmin, getAllMenus, getAllOrders, getAllRecipesAdmin, getAllSalesAdmin, getCategories, getMenuById, getProductDetailAdmin, getProducts, getRecipeByIdAdmin, getSaleItems, getSpecialDetailAdmin, getSpecials, processCancelOrder, registerUser, updateCategory, updateIngredient, updateMenu, updateProductAdmin, updateRecipeAdmin, updateSale, updateSpecialAdmin, updateUser } from "../controller/adminController.js"
const router = express.Router()

// Get
router.get("/users-get", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getAdminAndShippers);
router.get("/get-all-orders", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getAllOrders);
router.get("/get-all-products", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getProducts);
router.get("/get-all-category", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getCategories);
router.get("/get-all-specials", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getSpecials);
router.get("/get-all-recipes", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getAllRecipesAdmin);
router.get("/get-all-ingredients", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getAllIngredientsAdmin);
router.get("/get-all-menus", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getAllMenus);
router.get("/get-all-sales", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getSaleItems);
router.get("/get-sales", protectRoute, authorizeRole(["admin", "super_admin"]), validate(paginationQuery, "query"), getAllSalesAdmin);
router.get("/get-product-detail/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), getProductDetailAdmin);
router.get("/get-special-detail/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), getSpecialDetailAdmin);
router.get("/get-recipe-detail/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), getRecipeByIdAdmin);
router.get("/get-menu-detail/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), getMenuById);

// Create
router.post("/create-user", protectRoute, authorizeRole(["admin", "super_admin"]), validate(adminUserSchema), registerUser)
router.post("/create-category", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(categorySchema), createCategory)
router.post("/create-product", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createProduct)
router.post("/create-sale", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(saleSchema), createSale)
router.post("/create-ingredient", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createIngredient)
router.post("/create-recipe", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createRecipeAdmin)
router.post("/create-menu", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("image"), validate(catalogSchema), createMenu)

// Update
router.patch("/users-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), validate(adminUserUpdateSchema), updateUser);
router.put("/category-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("image"), validate(categorySchema.fork(["name"], (schema) => schema.optional())), updateCategory);
router.put("/product-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("image"), validate(catalogSchema), updateProductAdmin);
router.put("/special-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("image"), validate(catalogSchema), updateSpecialAdmin);
router.put("/sale-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("image"), validate(saleSchema.fork(["percent", "startDate", "endDate"], (schema) => schema.optional())), updateSale);
router.put("/ingredient-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("image"), validate(catalogSchema), updateIngredient);
router.put("/recipe-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("image"), validate(catalogSchema), updateRecipeAdmin);
router.put("/menu-update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("image"), validate(catalogSchema), updateMenu);

// Delete
router.delete("/users-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteUser);
router.delete("/category-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteCategory);
router.delete("/product-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteProductAdmin);
router.delete("/special-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteSpecialAdmin);
router.delete("/sale-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteSale);
router.delete("/ingredient-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteIngredient);
router.delete("/recipe-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteRecipeAdmin);
router.delete("/menu-delete/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), deleteMenu);

// Admin role
router.patch("/process-cancel", protectRoute, authorizeRole(["admin", "super_admin"]), validate(adminCancelSchema), processCancelOrder);
router.post("/assign-order", protectRoute, authorizeRole(["admin", "super_admin"]), validate(assignOrderSchema), assignOrderToShipper)
router.post("/approve-order-cancelled", protectRoute, authorizeRole(["admin", "super_admin"]), validate(adminCancelSchema), approveCancelOrder)

export default router
