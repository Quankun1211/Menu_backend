import slugify from "slugify"
import {Category} from "../models/categoriesModel.js"
import cloudinary from "../config/cloudinary.js"
import { getOrSetCache } from "../utils/redis.utils.js";
export const createCategories = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const existedCategory = await Category.findOne({ slug });
    if (existedCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories",
      });
      imageUrl = uploadResult.secure_url;
    }

    const newCategory = await Category.create({
      name,
      slug,
      image: imageUrl,
    });

    return res.status(201).json({
      code: 201,
      data: newCategory,
    });
  } catch (error) {
    console.error("Create category error:", error.message);
    return res.status(500).json({ error: "Internal server" });
  }
};

export const getCategories = async (req, res) => {
    try {
        const limit = Number(req.query.limit);
        
        const cacheKey = `categories:product:limit:${Number.isInteger(limit) ? limit : 'all'}`;

        const categories = await getOrSetCache(cacheKey, async () => {
            return await Category.find()
                .sort({ createdAt: -1 })
                .limit(Number.isInteger(limit) ? limit : 0)
                .lean(); 
        });


        return res.status(200).json({
            code: 200,
            data: categories,
        });
    } catch (error) {
        console.error("Get categories error:", error.message);
        return res.status(500).json({ error: "Internal server" });
    }
};
/*
696af02fac884f3578d9ac97
696af047ac884f3578d9ac9a
696af05dac884f3578d9aca1
*/
