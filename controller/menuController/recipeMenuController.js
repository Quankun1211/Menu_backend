import slugify from "slugify";
import { Ingredient } from "../../models/menuModels/ingredientModel.js";
import { Recipe } from "../../models/menuModels/RecipeModel.js";
import cloudinary from "../../config/cloudinary.js";
import {User} from "../../models/userModel.js"
import mongoose from "mongoose";
export const createRecipe = async (req, res) => {
  try {
    const { 
      name, 
      ingredients,
      description,
      instructions, 
      cookTime,
      difficulty,
      additionalIngredients,
      category,
      weatherTag,
      tips,
      meta,
      instructionUrl,
      suggestedSideDishes 
    } = req.body;

    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : 'admin';

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tên công thức là bắt buộc" });
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "Recipe"
      });
      imageUrl = uploadResult.secure_url;
    }

    const slug = `${slugify(name, { lower: true, strict: true })}-${Date.now()}`;

    const parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
    const parsedInstructions = typeof instructions === 'string' ? JSON.parse(instructions) : instructions;
    const parsedAdditional = typeof additionalIngredients === 'string' ? JSON.parse(additionalIngredients) : additionalIngredients;
    const parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
    const parsedTips = typeof tips === 'string' ? JSON.parse(tips) : tips;
    
    const parsedSideDishes = typeof suggestedSideDishes === 'string' 
      ? JSON.parse(suggestedSideDishes) 
      : suggestedSideDishes;

    const recipeData = {
      name,
      slug,
      description,
      image: imageUrl,
      category: category || null,
      ingredients: parsedIngredients,
      additionalIngredients: parsedAdditional,
      instructions: parsedInstructions,
      owner: userId,
      isSystem: userRole === 'admin',
      cookTime: Number(cookTime) || 30,
      difficulty: difficulty || "Dễ",
      weatherTag: weatherTag || 'neutral',
      instructionUrl,
      tips: parsedTips,
      suggestedSideDishes: parsedSideDishes, 
      meta: {
        servings: parsedMeta?.servings || "2-3",
        cookType: parsedMeta?.cookType || (userRole === 'admin' ? "Tự nấu tại nhà" : "Cá nhân nấu"),
        isPrepped: parsedMeta?.isPrepped || false
      }
    };

    const newRecipe = new Recipe(recipeData);
    await newRecipe.save();

    return res.status(201).json({
      success: true,
      message: "Tạo công thức thành công",
      data: newRecipe,
    });

  } catch (error) {
    console.error("Create recipe error:", error.message);
    return res.status(500).json({ error: "Lỗi hệ thống khi tạo công thức" });
  }
};

export const getRecipeDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const recipe = await Recipe.findById(id)
      .populate({
        path: "ingredients.ingredientId",
        select: "name customName price image images unit" 
      })
      .populate("category")
      .lean();

    if (!recipe) {
      return res.status(404).json({ message: "Không tìm thấy công thức" });
    }

    const extraInfo = [];
    if (recipe.tips?.nutrition) extraInfo.push({ type: 'nutrition', data: recipe.tips.nutrition });
    if (recipe.tips?.folkTips?.length > 0) extraInfo.push({ type: 'folkTips', data: recipe.tips.folkTips });
    if (recipe.suggestedSideDishes?.dishes?.length > 0) extraInfo.push({ type: 'suggestedSideDishes', data: recipe.suggestedSideDishes });

    const { tips, suggestedSideDishes, ...restOfRecipe } = recipe;

    return res.status(200).json({
      success: true,
      data: { ...restOfRecipe, extraInfo },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getRecipesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const userId = req.user?.id; 
    
    let filter = {isDeleted: false};
    if (categoryId && categoryId !== 'all') {
      filter.category = categoryId;
    }

    const recipes = await Recipe.find(filter)
      .populate("ingredients.ingredientId", "name customName image images")
      .populate("category")
      .sort({ createdAt: -1 })
      .lean();

    let savedRecipeIds = [];
    if (userId) {
      const user = await User.findById(userId).select("savedRecipes");
      if (user && user.savedRecipes) {
        savedRecipeIds = user.savedRecipes.map(id => id.toString());
      }
    }

    const formattedRecipes = recipes.map(recipe => {
      const extraInfo = [];

      if (recipe.tips?.nutrition) {
        extraInfo.push({ 
          type: 'nutrition', 
          data: recipe.tips.nutrition 
        });
      }

      if (recipe.tips?.folkTips && recipe.tips.folkTips.length > 0) {
        extraInfo.push({ 
          type: 'folkTips', 
          data: recipe.tips.folkTips 
        });
      }

      if (recipe.suggestedSideDishes) {
        extraInfo.push({ 
          type: 'suggestedSideDishes', 
          data: recipe.suggestedSideDishes 
        });
      }
      
      const { tips, suggestedSideDishes, ...rest } = recipe;

      return { 
        ...rest, 
        extraInfo,
        isSaved: savedRecipeIds.includes(recipe._id.toString()) 
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedRecipes.length,
      data: formattedRecipes,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const createRecipePostman = async (req, res) => {
  try {
    let { 
      name, 
      ingredients, 
      meta, 
      difficulty, 
      instructionUrl, 
      cookTime 
    } = req.body;

    try {
      if (typeof ingredients === 'string') {
        ingredients = JSON.parse(ingredients);
      }
      if (typeof meta === 'string') {
        meta = JSON.parse(meta);
      }
    } catch (parseError) {
      return res.status(400).json({ message: "Invalid JSON format for ingredients or meta" });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Recipe name is required" });
    }

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ message: "Ingredients list cannot be empty" });
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "Recipe",
      });
      imageUrl = uploadResult.secure_url;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Recipe image is required" });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const existedRecipe = await Recipe.findOne({ 
      $or: [{ name }, { slug }] 
    });
    
    if (existedRecipe) {
      return res.status(400).json({ message: "This recipe or slug already exists" });
    }

    const validIngredients = await Ingredient.find({ _id: { $in: ingredients } });
    if (validIngredients.length !== ingredients.length) {
      return res.status(400).json({ 
        message: "One or more ingredient IDs are invalid or do not exist" 
      });
    }

    const newRecipe = new Recipe({
      name,
      slug, 
      image: imageUrl,
      ingredients,
      meta: {
        servings: meta?.servings || "2-3",
        cookType: meta?.cookType || "Tự nấu tại nhà",
        isPrepped: meta?.isPrepped || false
      },
      difficulty: difficulty || "Dễ",
      instructionUrl,
      cookTime: Number(cookTime) || 0
    });

    await newRecipe.save();

    return res.status(201).json({
      code: 201,
      message: "Recipe created successfully",
      data: newRecipe,
    });

  } catch (error) {
    console.log("Catch");
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: "Validation Error: Check difficulty enum or required fields" });
    }
    console.error("Create recipe error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getLatestRecipeDetail = async (req, res) => {
  try {
    let filter = {isDeleted: false};

    const recipe = await Recipe.findOne(filter)
      .populate("ingredients")
      .sort({ createdAt: -1 })
      .lean();

    if (!recipe) {
      return res.status(404).json({ message: "No recipes found" });
    }

    const extraInfo = [];

    if (recipe.tips?.nutrition && (recipe.tips.nutrition.calories || recipe.tips.nutrition.description)) {
      extraInfo.push({ type: 'nutrition', data: recipe.tips.nutrition });
    }
    
    if (recipe.tips?.folkTips && recipe.tips.folkTips.length > 0) {
      extraInfo.push({ type: 'folkTips', data: recipe.tips.folkTips });
    }

    if (recipe.suggestedSideDishes && recipe.suggestedSideDishes.dishes?.length > 0) {
      extraInfo.push({ type: 'suggestedSideDishes', data: recipe.suggestedSideDishes });
    }

    const { tips, suggestedSideDishes, ...restOfRecipe } = recipe;

    return res.status(200).json({
      code: 200,
      data: {
        ...restOfRecipe,
        extraInfo 
      },
    });
  } catch (error) {
    console.error("Get latest recipe error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleSaveRecipe = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);

    const isSaved = user.savedRecipes.includes(recipeId);

    if (isSaved) {
      user.savedRecipes = user.savedRecipes.filter(id => id.toString() !== recipeId);
    } else {
      user.savedRecipes.push(recipeId);
    }

    await user.save();

    res.status(200).json({
      success: true,
      isSaved: !isSaved,
      message: isSaved ? "Đã bỏ lưu công thức" : "Đã lưu công thức thành công"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi xử lý" });
  }
};

export const getSavedRecipes = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "savedRecipes",
      select: "name image cookTime owner difficulty description", 
      populate: { path: "owner", select: "username" } 
    });

    res.status(200).json({
      success: true,
      data: user.savedRecipes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách đã lưu" });
  }
};