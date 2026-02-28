import slugify from "slugify";
import mongoose from "mongoose";
import { Product } from "../../models/productsModel.js"
import { Ingredient } from "../../models/menuModels/ingredientModel.js";
import cloudinary from "../../config/cloudinary.js";
export const createIngredient = async (req, res) => {
  try {
    const { customName, price, unit } = req.body;

    if (!customName) {
      return res.status(400).json({ message: "Custom name is required" });
    }

    let imageUrl = "";
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, { 
        folder: "Ingredient" 
      });
      imageUrl = uploadResult.secure_url;
    }

    const slug = slugify(customName, { lower: true, strict: true });

    const existed = await Ingredient.findOne({ slug, creatorId: null });
    if (existed) {
      return res.status(200).json({ 
        success: true, 
        data: existed, 
        message: "Ingredient already exists in system" 
      });
    }

    const newIngredient = await Ingredient.create({
      customName,
      slug,
      price: Number(price) || 0,
      unit: unit || "đv",
      image: imageUrl || "",
      creatorId: null 
    });

    return res.status(201).json({ success: true, data: newIngredient });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getAllIngredient = async (req, res) => {
  try {
    const ingredients = await Ingredient.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: ingredients,
    });
  } catch (error) {
    return res.status(500).json({ error: "Lỗi hệ thống khi lấy danh sách nguyên liệu" });
  }
};

export const getIngredientById = async (req, res) => {
  try {
    const { ingredientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(ingredientId)) {
      return res.status(400).json({ message: "ID nguyên liệu không hợp lệ" });
    }

    const ingredient = await Ingredient.findById(ingredientId);

    if (!ingredient) {
      return res.status(404).json({ message: "Không tìm thấy nguyên liệu" });
    }

    return res.status(200).json({
      success: true,
      data: ingredient,
    });
  } catch (error) {
    return res.status(500).json({ error: "Lỗi hệ thống khi lấy chi tiết nguyên liệu" });
  }
};

export const getSystemIngredients = async (req, res) => {
  try {
    const ingredients = await Ingredient.find({ creatorId: null })
      .sort({ customName: 1 });

    return res.status(200).json({
      success: true,
      data: ingredients
    });
  } catch (error) {
    console.error("Get system ingredients error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteIngredient = async (req, res) => {
  try {
    const { ingredientId } = req.params;
    await Ingredient.findByIdAndDelete(ingredientId);
    return res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};