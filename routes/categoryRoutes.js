import express from "express"
import { createCategories, getCategories } from "../controller/categoryController.js"
import upload from "../middleware/upload.js"
const router = express.Router()

router.post("/create", upload.single("images"), createCategories)
router.get("/get", getCategories)

export default router