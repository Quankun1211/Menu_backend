import express from "express"
import { 
    createProduct,
    createSaleItem,
    getNormalProducts,
    getPopularProducts,
    getProductDetail,
    getProductsByCategory,
    getProductsByFilter,
    getProductsByRegion,
    getShockDeals,
    getSuggestedProducts,
    previewCheckout,
    searchProducts,
    updateProduct, 
    getAllProductAdmin,
} from "../controller/productController.js"
import { authorizeRole, optionalProtectRoute, protectRoute } from "../middleware/protectRoute.js"
import upload from "../middleware/upload.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
import { validate } from "../middleware/validate.js"
import { catalogSchema, checkoutPreviewSchema, objectIdParams, paginationQuery, saleSchema, slugOrIdParams } from "../validation/schemas.js"
const router = express.Router()

// Static REST paths must precede /:id.
router.get("/search", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("search", "Product"), searchProducts)
router.get("/by-category", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_category", "Product"), getProductsByCategory)
router.get("/by-region", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_region", "Product"), getProductsByRegion)
router.get("/popular", validate(paginationQuery, "query"), optionalProtectRoute, getPopularProducts)
router.get("/deals", validate(paginationQuery, "query"), optionalProtectRoute, getShockDeals)
router.get("/suggestions", validate(paginationQuery, "query"), optionalProtectRoute, getSuggestedProducts)

router.get(["/get-product-detail/:id", "/:id"], validate(slugOrIdParams(), "params"), optionalProtectRoute, trackBehavior("view", "Product"), getProductDetail)
router.get("/search", validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("search", "Product"), searchProducts)
router.get(["/get-by-category", "/by-category"], validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_category", "Product"), getProductsByCategory)
router.get(["/get-by-region", "/by-region"], validate(paginationQuery, "query"), optionalProtectRoute, trackBehavior("view_region", "Product"), getProductsByRegion)

router.get(["/get-popular", "/popular"], validate(paginationQuery, "query"), optionalProtectRoute, getPopularProducts)
router.get(["/get-shock-deals", "/deals"], validate(paginationQuery, "query"), optionalProtectRoute, getShockDeals)
router.get(["/get-suggestion", "/suggestions"], validate(paginationQuery, "query"), optionalProtectRoute, getSuggestedProducts)

router.post("/create-normal", protectRoute, authorizeRole(["admin", "super_admin"]), upload.single("images"), validate(catalogSchema), createProduct)
router.post("/create/sale", protectRoute, authorizeRole(["admin", "super_admin"]), validate(saleSchema), createSaleItem)
router.post("/checkout/preview", protectRoute, validate(checkoutPreviewSchema), previewCheckout) 

router.get("/get-by-normal", validate(paginationQuery, "query"), getNormalProducts)
router.get(["/get-by-filter", "/"], validate(paginationQuery, "query"), getProductsByFilter)
router.put("/update/:id", protectRoute, authorizeRole(["admin", "super_admin"]), validate(objectIdParams(), "params"), upload.single("images"), validate(catalogSchema), updateProduct)

export default router
