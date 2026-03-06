import slugify from "slugify";
import { Menu } from "../../models/menuModels/menuModel.js";
import { Recipe } from "../../models/menuModels/RecipeModel.js";
import cloudinary from "../../config/cloudinary.js";
import mongoose from "mongoose";
export const createMenu = async (req, res) => {
  try {
    let { 
      title, 
      titleBanner, 
      description, 
      category, 
      meta, 
      recipes, 
      cookTime 
    } = req.body;

    try {
      if (typeof recipes === 'string') recipes = JSON.parse(recipes);
      if (typeof meta === 'string') meta = JSON.parse(meta);
    } catch (e) {
      return res.status(400).json({ message: "Invalid format for recipes or meta" });
    }

    if (!title || !titleBanner || !recipes || recipes.length === 0) {
      return res.status(400).json({ message: "Title, TitleBanner and Recipes are required" });
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "Menu",
      });
      imageUrl = uploadResult.secure_url;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Menu image is required" });
    }

    const slug = slugify(title, { lower: true, strict: true });
    const existedMenu = await Menu.findOne({ slug });
    if (existedMenu) {
      return res.status(400).json({ message: "Menu title already exists" });
    }

    const recipeDetails = await Recipe.find({ _id: { $in: recipes } }).populate("ingredients");
    if (recipeDetails.length !== recipes.length) {
      return res.status(400).json({ message: "One or more recipe IDs are invalid" });
    }

    let calculatedTotalPrice = 0;
    recipeDetails.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        calculatedTotalPrice += (ing.price || 0);
      });
    });

    const newMenu = new Menu({
      title,
      titleBanner,
      slug,
      description,
      image: imageUrl,
      category,
      meta: {
        servings: meta?.servings || "2-3",
        cookType: meta?.cookType || "Tự nấu tại nhà",
        isPrepped: meta?.isPrepped || false
      },
      recipes,
      cookTime: Number(cookTime) || 0,
      totalPrice: calculatedTotalPrice
    });

    await newMenu.save();

    return res.status(201).json({
      code: 201,
      message: "Menu created successfully",
      data: newMenu,
    });

  } catch (error) {
    console.error("Create menu error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMenus = async (req, res) => {
    try {
        const { categoryId } = req.query;
        let filter = { isDeleted: false }; 

        if (categoryId && categoryId !== 'all' && categoryId !== 'undefined') {
            if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                return res.status(400).json({ message: "Định dạng Category ID không hợp lệ" });
            }
            filter.category = new mongoose.Types.ObjectId(categoryId);
        }

        const menus = await Menu.find(filter)
            .populate({
                path: 'recipes',
                match: { isDeleted: false }, 
                populate: {
                    path: 'ingredients.ingredientId'
                }
            })
            .populate('category')
            .sort({ createdAt: -1 })
            .lean();

        const updatedMenus = menus.map(menu => {
            let totalPriceAll = 0;
            let totalPriceInDB = 0;

            if (menu.recipes && menu.recipes.length > 0) {
                menu.recipes.forEach(recipe => {
                    if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
                        recipe.ingredients.forEach(recipeIng => {
                            const details = recipeIng.ingredientId;
                            if (details && details.price) {
                                const useQuantity = recipeIng.quantity || 0;
                                const lineTotal = details.price * useQuantity;
                                totalPriceAll += lineTotal;

                                if (recipeIng.itemType === 'Product' || details.productId) {
                                    totalPriceInDB += lineTotal;
                                }
                            }
                        });
                    }
                });
            }

            return {
                ...menu,
                totalPrice: Math.round(totalPriceAll),
                totalPriceInDB: Math.round(totalPriceInDB)
            };
        });

        return res.status(200).json({
            code: 200,
            count: updatedMenus.length,
            data: updatedMenus,
        });
    } catch (error) {
        console.error("Get menus error:", error.message);
        return res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

export const getMenuDetail = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid Menu ID format" });
        }

        const menu = await Menu.findOne({ _id: id, isDeleted: false })
            .populate({
                path: 'recipes',
                match: { isDeleted: false },
                populate: {
                    path: 'ingredients.ingredientId'
                }
            })
            .populate('category')
            .lean();

        if (!menu) {
            return res.status(404).json({ message: "Menu not found or has been deleted" });
        }

        let totalPriceAll = 0;
        let totalPriceInDB = 0;

        if (menu.recipes) {
            menu.recipes.forEach(recipe => {
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        const detail = ing.ingredientId;
                        if (detail) {
                            const finalName = detail.customName || detail.name;
                            const finalPrice = detail.price || 0;
                            const finalImage = detail.image || '';
                            const finalUnit = detail.unit || '';

                            ing.ingredientId = {
                                ...detail,
                                displayName: finalName,
                                price: finalPrice,
                                image: finalImage,
                                unit: finalUnit
                            };

                            const lineTotal = finalPrice * (ing.quantity || 0);
                            totalPriceAll += lineTotal;

                            if (ing.itemType === 'Product' || detail.productId) {
                                totalPriceInDB += lineTotal;
                            }
                        }
                    });
                }
            });
        }

        return res.status(200).json({
            code: 200,
            data: {
                ...menu,
                totalPrice: Math.round(totalPriceAll),
                totalPriceInDB: Math.round(totalPriceInDB)
            },
        });

    } catch (error) {
        console.error("Get menu detail error:", error.message);
        return res.status(500).json({ error: "Internal server error" });
    }
};