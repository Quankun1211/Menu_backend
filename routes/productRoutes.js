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

const router = express.Router()

router.post("/create-normal", upload.single("images"), createProduct)
router.post("/create-special", upload.single("images"), createSpecialtyProduct)
router.post("/create/sale", createSaleItem)
router.post("/checkout/preview", previewCheckout)
router.get("/get-popular", getPopularProducts)
router.get("/get-shock-deals", getShockDeals)
// router.get("/get-all-admin", getAllProductAdmin)
router.get("/get-suggestion", optionalProtectRoute, getSuggestedProducts)
router.get("/get-by-category", getProductsByCategory)
router.get("/get-by-region", getProductsByRegion)
router.get("/get-by-special", getProductsSpecialByRegion)
router.get("/get-latest-specialty", getLatestSpecialtyProduct)
router.get("/get-by-normal", getNormalProducts)
router.get("/get-by-filter", getProductsByFilter)
router.put("/update/:id", upload.single("images"), updateProduct)
router.get("/get-product-detail/:id", getProductDetail)
router.get("/search", searchProducts)

export default router