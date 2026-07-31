import express from "express";
import {
  getPopularProducts,
  getProductDetail,
  getProductsByCategory,
  getProductsByFilter,
  getProductsByRegion,
  getShockDeals,
  getSuggestedProducts,
  searchProducts,
} from "../controller/productController.js";
import { optionalProtectRoute } from "../middleware/protectRoute.js";
import { validate } from "../middleware/validate.js";
import { paginationQuery, slugOrIdParams } from "../validation/schemas.js";
import { trackBehavior } from "../utils/trackingUserBehavior.js";

const router = express.Router();

const listProducts = (req, res, next) => {
  if (req.query.q) return searchProducts(req, res, next);
  if (req.query.region) return getProductsByRegion(req, res, next);
  if (req.query.categoryId) return getProductsByCategory(req, res, next);
  if (req.query.view === "popular") return getPopularProducts(req, res, next);
  if (req.query.view === "deals") return getShockDeals(req, res, next);
  if (req.query.view === "suggested") return getSuggestedProducts(req, res, next);
  return getProductsByFilter(req, res, next);
};

router.get("/", validate(paginationQuery, "query"), optionalProtectRoute, listProducts);
router.get("/:id", validate(slugOrIdParams(), "params"), optionalProtectRoute, trackBehavior("view", "Product"), getProductDetail);

export default router;
