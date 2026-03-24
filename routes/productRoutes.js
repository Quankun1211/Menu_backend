import express from "express"
import { 
    createProduct,
    createSaleItem,
    createSpecialtyProduct,
    getNormalProducts,
    getPopularProducts,
    getProductDetail,
    getProductsByCategory,
    getProductsByFilter,
    getProductsByRegion,
    getProductsSpecialByRegion,
    getShockDeals,
    getSuggestedProducts,
    previewCheckout,
    searchProducts,
    updateProduct, 
    getAllProductAdmin,
    getLatestSpecialtyProduct
} from "../controller/productController.js"
import { optionalProtectRoute, protectRoute } from "../middleware/protectRoute.js"
import upload from "../middleware/upload.js"
import { trackBehavior } from "../utils/trackingUserBehavior.js"
const router = express.Router()

router.get("/get-product-detail/:id", optionalProtectRoute, trackBehavior("view", "Product"), getProductDetail)
router.get("/search", optionalProtectRoute, trackBehavior("search", "Product"), searchProducts)
router.get("/get-by-category", optionalProtectRoute, trackBehavior("view_category", "Product"), getProductsByCategory)
router.get("/get-by-region", optionalProtectRoute, trackBehavior("view_region", "Product"), getProductsByRegion)

router.get("/get-popular", optionalProtectRoute, getPopularProducts)
router.get("/get-shock-deals", optionalProtectRoute, getShockDeals)
router.get("/get-suggestion", optionalProtectRoute, getSuggestedProducts)

router.post("/create-normal", upload.single("images"), createProduct)
router.post("/create-special", upload.single("images"), createSpecialtyProduct)
router.post("/create/sale", createSaleItem)
router.post("/checkout/preview", protectRoute, previewCheckout) 

router.get("/get-by-special", getProductsSpecialByRegion)
router.get("/get-latest-specialty", getLatestSpecialtyProduct)
router.get("/get-by-normal", getNormalProducts)
router.get("/get-by-filter", getProductsByFilter)
router.put("/update/:id", upload.single("images"), updateProduct)

export default router