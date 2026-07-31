import express from "express";
import { getMenuDetail, getMenus } from "../../controller/menuController/menuController.js";
import { optionalProtectRoute } from "../../middleware/protectRoute.js";
import { trackBehavior } from "../../utils/trackingUserBehavior.js";
import { validate } from "../../middleware/validate.js";
import { paginationQuery, slugOrIdParams } from "../../validation/schemas.js";

const router = express.Router();

router.get("/", validate(paginationQuery, "query"), getMenus);
router.get("/:id", validate(slugOrIdParams(), "params"), optionalProtectRoute, trackBehavior("view", "Menu"), getMenuDetail);

export default router;
