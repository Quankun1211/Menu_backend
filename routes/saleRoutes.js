import express from "express";
import { getSaleItems } from "../controller/saleController.js";
import { validate } from "../middleware/validate.js";
import { paginationQuery } from "../validation/schemas.js";

const router = express.Router();

router.get("/", validate(paginationQuery, "query"), getSaleItems);

export default router;
