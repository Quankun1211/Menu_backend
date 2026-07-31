import express from "express";
import { getCategoryMenu } from "../../controller/menuController/categoryMenuController.js";
import { validate } from "../../middleware/validate.js";
import { paginationQuery } from "../../validation/schemas.js";

const router = express.Router();

router.get("/", validate(paginationQuery, "query"), getCategoryMenu);

export default router;
