import express from "express";
import upload from "../middleware/upload.js";
import { protectRoute, authorizeRole } from "../middleware/protectRoute.js";
import { validate } from "../middleware/validate.js";
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
  reassignOrderSchema,
} from "../validation/schemas.js";
import {
  assignOrderToShipper,
  createCategory,
  createIngredient,
  createMenu,
  createProduct,
  createRecipeAdmin,
  createSale,
  deleteCategory,
  deleteIngredient,
  deleteMenu,
  deleteProductAdmin,
  deleteRecipeAdmin,
  deleteSale,
  deleteSpecialAdmin,
  deleteUser,
  getAdminAndShippers,
  getAllIngredientsAdmin,
  getAllMenus,
  getAllOrders,
  getAllRecipesAdmin,
  getAllSalesAdmin,
  getCategories,
  getMenuById,
  getProductDetailAdmin,
  getProducts,
  getRecipeByIdAdmin,
  getSpecialDetailAdmin,
  getSpecials,
  registerUser,
  reassignOrderToShipper,
  updateCategory,
  updateIngredient,
  updateMenu,
  updateProductAdmin,
  updateRecipeAdmin,
  updateSale,
  updateSpecialAdmin,
  updateUser,
  activateUser,
  activateProductAdmin,
  activateSpecialAdmin,
  restoreCategory,
  restoreRecipeAdmin,
  activeMenu,
} from "../controller/adminController.js";
import { processShipperCancellation, retryOrderRefund } from "../controller/orderCancellationController.js";
import { getDashboardOverview } from "../controller/adminDashboardController.js";
import { getTransactionsAdmin } from "../controller/adminTransactionController.js";

const router = express.Router();
const idParams = validate(objectIdParams(), "params");

const adminOnly = authorizeRole(["admin", "super_admin"]);
const superAdminOnly = authorizeRole(["super_admin"]);
router.use(protectRoute, adminOnly);

router.get("/dashboard", getDashboardOverview);

router.get("/users", validate(paginationQuery, "query"), getAdminAndShippers);
router.post("/users", superAdminOnly, validate(adminUserSchema), registerUser);
router.patch("/users/:id", superAdminOnly, idParams, validate(adminUserUpdateSchema), updateUser);
router.delete("/users/:id", superAdminOnly, idParams, deleteUser);
router.put("/users/:id", superAdminOnly, idParams, activateUser);

router.get("/orders", validate(paginationQuery, "query"), getAllOrders);
router.post("/order-assignments", validate(assignOrderSchema), assignOrderToShipper);
router.put(
  "/orders/:orderId/assignment",
  validate(objectIdParams("orderId"), "params"),
  validate(reassignOrderSchema),
  reassignOrderToShipper,
);
router.patch("/orders/cancellation-requests", validate(adminCancelSchema), processShipperCancellation);
router.get("/transactions", validate(paginationQuery, "query"), getTransactionsAdmin);
router.post(
  "/refunds/:orderId/attempts",
  validate(objectIdParams("orderId"), "params"),
  retryOrderRefund,
);

router.get("/products", validate(paginationQuery, "query"), getProducts);
router.get("/products/:id", idParams, getProductDetailAdmin);
router.post("/products", upload.single("image"), validate(catalogSchema), createProduct);
router.put("/products/:id", idParams, upload.single("image"), validate(catalogSchema), updateProductAdmin);
router.delete("/products/:id", idParams, deleteProductAdmin);
router.patch("/products/:id", idParams, activateProductAdmin);

router.get("/specials", validate(paginationQuery, "query"), getSpecials);
router.get("/specials/:id", idParams, getSpecialDetailAdmin);
router.put("/specials/:id", idParams, upload.single("image"), validate(catalogSchema), updateSpecialAdmin);
router.delete("/specials/:id", idParams, deleteSpecialAdmin);
router.patch("/specials/:id", idParams, activateSpecialAdmin);

router.get("/categories", validate(paginationQuery, "query"), getCategories);
router.post("/categories", upload.single("image"), validate(categorySchema), createCategory);
router.put(
  "/categories/:id",
  idParams,
  upload.single("image"),
  validate(categorySchema.fork(["name"], (schema) => schema.optional())),
  updateCategory,
);
router.delete("/categories/:id", idParams, deleteCategory);
router.patch("/categories/:id", idParams, restoreCategory);

router.get("/sales", validate(paginationQuery, "query"), getAllSalesAdmin);
router.post("/sales", superAdminOnly, upload.single("image"), validate(saleSchema), createSale);
router.put(
  "/sales/:id",
  superAdminOnly,
  idParams,
  upload.single("image"),
  validate(saleSchema.fork(["percent", "startDate", "endDate"], (schema) => schema.optional())),
  updateSale,
);
router.delete("/sales/:id", superAdminOnly, idParams, deleteSale);

router.get("/ingredients", validate(paginationQuery, "query"), getAllIngredientsAdmin);
router.post("/ingredients", upload.single("image"), validate(catalogSchema), createIngredient);
router.put("/ingredients/:id", idParams, upload.single("image"), validate(catalogSchema), updateIngredient);
router.delete("/ingredients/:id", idParams, deleteIngredient);

router.get("/recipes", validate(paginationQuery, "query"), getAllRecipesAdmin);
router.get("/recipes/:id", idParams, getRecipeByIdAdmin);
router.post("/recipes", upload.single("image"), validate(catalogSchema), createRecipeAdmin);
router.put("/recipes/:id", idParams, upload.single("image"), validate(catalogSchema), updateRecipeAdmin);
router.delete("/recipes/:id", idParams, deleteRecipeAdmin);
router.patch("/recipes/:id", idParams, restoreRecipeAdmin);

router.get("/menus", validate(paginationQuery, "query"), getAllMenus);
router.get("/menus/:id", idParams, getMenuById);
router.post("/menus", upload.single("image"), validate(catalogSchema), createMenu);
router.put("/menus/:id", idParams, upload.single("image"), validate(catalogSchema), updateMenu);
router.delete("/menus/:id", idParams, deleteMenu);
router.patch("/menus/:id", idParams, activeMenu);

export default router;
