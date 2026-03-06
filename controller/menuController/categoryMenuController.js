import slugify from "slugify"
import cloudinary from "../../config/cloudinary.js";
import { CategoryMenu } from "../../models/menuModels/categoryMenuModel.js";
import { CategoryRecipe } from "../../models/RecipeModels/categoryRecipeModel.js";
export const createCategoryMenu = async (req, res) => {
  try {
    const { name, title, description } = req.body;

    if (!name || !name.trim() || !description || !description.trim() || !title || !title.trim()) {
      return res.status(400).json({ message: "Name or Description is required" });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const existedCategory = await CategoryMenu.findOne({ slug });
    if (existedCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const newCategory = await CategoryMenu.create({
      name,
      slug,
      title,
      description
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

export const getCategoryMenu = async (req, res) => {
  try {
    const categories = await CategoryMenu.find({isDeleted: false})
    return res.status(200).json({
      code: 200,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error.message);
    return res.status(500).json({ error: "Internal server" });
  }
};

export const createCategoryRecipe = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim() || !description || !description.trim()) {
      return res.status(400).json({ message: "Name or Description is required" });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const existedCategory = await CategoryRecipe.findOne({ slug });
    if (existedCategory) {
      return res.status(400).json({ message: "CategoryRecipe already exists" });
    }

    const newCategory = await CategoryRecipe.create({
      name,
      slug,
      description
    });

    return res.status(201).json({
      code: 201,
      data: newCategory,
    });
  } catch (error) {
    console.error("CategoryRecipe category error:", error.message);
    return res.status(500).json({ error: "Internal server" });
  }
};
export const getCategoryRecipe = async (req, res) => {
  try {
    const categories = await CategoryRecipe.find({isDeleted: false})
    return res.status(200).json({
      code: 200,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error.message);
    return res.status(500).json({ error: "Internal server" });
  }
};
