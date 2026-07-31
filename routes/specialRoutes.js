import express from "express";
import { getLatestSpecial, getProductsSpecialByRegion, getSpecialDetail } from "../controller/specialController.js";
import { validate } from "../middleware/validate.js";
import { paginationQuery, slugOrIdParams } from "../validation/schemas.js";

const router = express.Router();

router.get(
  "/",
  validate(paginationQuery, "query"),
  (req, res, next) => (
    req.query.view === "latest"
      ? getLatestSpecial(req, res, next)
      : getProductsSpecialByRegion(req, res, next)
  ),
);
router.get("/:id", validate(slugOrIdParams(), "params"), getSpecialDetail);

export default router;
