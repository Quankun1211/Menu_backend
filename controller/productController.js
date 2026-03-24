import slugify from "slugify"
import { Product } from "../models/productsModel.js"
import { SaleItem } from "../models/saleItemModel.js"
import cloudinary from "../config/cloudinary.js"
import { User } from "../models/userModel.js";
import mongoose from "mongoose";
import {FavouriteItem} from "../models/favouriteItem.js"
import {Favourite} from "../models/favouriteModel.js"
import { Ingredient } from "../models/menuModels/ingredientModel.js";
import { Recipe } from "../models/menuModels/RecipeModel.js";
import axios from "axios";
import { triggerAIUpdate } from "../utils/trackingUserBehavior.js";

export const createProduct = async (req, res) => {
  try {
    const data = req.body;

    const parseJSON = (field) => {
      if (!field) return undefined;
      if (typeof field === "string") {
        try {
          return JSON.parse(field);
        } catch (e) {
          return field;
        }
      }
      return field;
    };

    const usage_instruction = parseJSON(data.usage_instruction);
    const season = parseJSON(data.season);
    const nutrition = parseJSON(data.nutrition);

    const {
      name,
      categoryId,
      price,
      unit,
      description,
      stock,
      soldCount = 0,
      viewCount = 0,
      favouriteCount = 0,
      salePercent,
      region,
      isSpecialty = false,
      origin,
      originDescription,
      originFound,
      story,
      isActive = true,
    } = data;

    if (!name || !price || !unit || !description || !stock || !region || !origin || !originDescription || !originFound || !story) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const existedProduct = await Product.findOne({ slug });
    if (existedProduct) {
      return res.status(400).json({ message: "Product already exists" });
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "products",
      });
      imageUrl = uploadResult.secure_url;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const validSalePercent = (salePercent && salePercent.trim() !== "") ? salePercent : null;
    const validCategoryId = (categoryId && categoryId.trim() !== "") ? categoryId : null;

    const newProduct = await Product.create({
      name,
      slug,
      categoryId: validCategoryId,
      price: Number(price),
      unit,
      description,
      images: imageUrl,
      stock: Number(stock),
      soldCount: Number(soldCount),
      viewCount: Number(viewCount),
      favouriteCount: Number(favouriteCount),
      salePercent: validSalePercent,
      region,
      nutrition: {
        calories: Number(nutrition?.calories) || 0,
        protein: Number(nutrition?.protein) || 0,
        fat: Number(nutrition?.fat) || 0,
        carbs: Number(nutrition?.carbs) || 0,
      },
      usage_instruction: Array.isArray(usage_instruction) ? usage_instruction : [],
      isSpecialty: String(isSpecialty) === "true",
      origin,
      originDescription,
      originFound,
      story,
      season: Array.isArray(season) ? season : [],
      isActive: String(isActive) === "true",
    });

    return res.status(201).json({
      code: 201,
      data: newProduct,
    });
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createSpecialtyProduct = async (req, res) => {
  try {
    const data = req.body;

    const parseJSON = (field) => {
      if (!field) return undefined;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch (e) {
          return field;
        }
      }
      return field;
    };

    const usage_instruction = parseJSON(data.usage_instruction);
    const season = parseJSON(data.season);
    const nutrition = parseJSON(data.nutrition);

    const {
      name, price, unit, description, stock,
      soldCount = 0, viewCount = 0, favouriteCount = 0,
      salePercent, region, isActive = true,
      origin, originDescription, originFound, story
    } = data;

    const baseFields = !name || !price || !unit || !description || !stock || !region;
    const specialtyFields = !originDescription || !originFound || !story || !origin;

    if (baseFields || specialtyFields) {
      return res.status(400).json({ 
        message: "Missing required fields" 
      });
    }

    const slug = slugify(name, { lower: true, strict: true });
    const validSalePercent = (salePercent && salePercent.trim() !== "") ? salePercent : null;
    
    const existedProduct = await Product.findOne({ slug });
    if (existedProduct) {
      return res.status(400).json({ message: "Product already exists" });
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "products"
      });
      imageUrl = uploadResult.secure_url;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const newProduct = await Product.create({
      name,
      slug,
      categoryId: null,
      price,
      unit,
      description,
      images: imageUrl,
      stock,
      soldCount,
      viewCount,
      favouriteCount,
      salePercent: validSalePercent,
      region,
      isSpecialty: true,
      usage_instruction,
      season,
      nutrition,
      isActive,
      origin,
      originDescription,
      originFound,
      story
    });

    return res.status(201).json({
      code: 201,
      data: newProduct
    });
  } catch (error) {
    console.error("Create specialty product error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
export const getPopularProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10
    const region = req.query.region

    const filter = {
      isActive: true,
      isSpecialty: false
    }

    if (region) {
      filter.region = region
    }

    const products = await Product.find(filter)
      .populate({
        path: "categoryId",
        select: "name slug" 
      })
      .sort({
        soldCount: -1,
        favouriteCount: -1,
        viewCount: -1
      })
      .limit(limit)
      .lean() 

    return res.status(200).json({
      code: 200,
      data: products
    })
  } catch (error) {
    console.error("Get popular products error:", error.message)
    return res.status(500).json({ error: "Internal server" })
  }
}

export const createSaleItem = async (req, res) => {
  try {
    const { percent, startDate, endDate } = req.body

    if (!percent || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing fields" })
    }

    if (percent <= 0 || percent >= 90) {
      return res.status(400).json({ message: "Invalid sale percent" })
    }

    const saleItem = await SaleItem.create({
      percent,
      startDate,
      endDate,
      isActive: true
    })

    res.status(201).json({
      message: "Create sale item success",
      data: saleItem
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getShockDeals = async (req, res) => {
  try {
    const now = new Date();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const pageSize = parseInt(limit);

    const products = await Product.find({
      salePercent: { $ne: null },
      isActive: true,
      isSpecialty: false
    })
      .populate({
        path: "salePercent",
        match: {
          startDate: { $lte: now },
          endDate: { $gte: now },
        },
        select: "percent startDate endDate",
      })
      .populate("categoryId", "name slug")
      .sort({ soldCount: -1 })
      .lean();

    const validProducts = products.filter(p => p.salePercent);
    
    const totalItems = validProducts.length;
    const paginatedProducts = validProducts.slice(skip, skip + limit);

    return res.status(200).json({
      code: 200,
      data: paginatedProducts,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: parseInt(page),
        pageSize,
        hasNextPage: skip + products.length < totalItems
      }
    });
  } catch (error) {
    console.error("Get shock deals error:", error);
    return res.status(500).json({ error: "Internal server" });
  }
};

export const getPopularProductsByRegion = async (req, res) => {
  try {
    const { region } = req.params
    const limit = parseInt(req.query.limit) || 10

    if (!["bac", "trung", "nam"].includes(region)) {
      return res.status(400).json({ message: "Invalid region" })
    }

    const products = await Product.find({
      region,
      isActive: true,
      isSpecialty: false
    })
      .sort({
        soldCount: -1,
        favouriteCount: -1,
        viewCount: -1
      })
      .limit(limit)

    return res.status(200).json({
      code: 200,
      data: products
    })
  } catch (error) {
    console.error("Get popular products by region error:", error)
    return res.status(500).json({ error: "Internal server" })
  }
}

const VIEW_COOLDOWN_MINUTES = 10;

export const trackView = async (req, res) => {
  try {
    const userId = req.user._id;
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({
        code: 400,
        message: "categoryId is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "User not found",
      });
    }

    const now = new Date();

    const historyItem = user.viewHistory.find(
      (item) => item.categoryId.toString() === categoryId
    );

    if (historyItem) {
      const diffMinutes =
        (now - new Date(historyItem.lastViewedAt)) / 1000 / 60;

      if (diffMinutes >= VIEW_COOLDOWN_MINUTES) {
        historyItem.viewCount += 1;
      }

      historyItem.lastViewedAt = now;
    } else {
      user.viewHistory.push({
        categoryId,
        viewCount: 1,
        lastViewedAt: now,
      });
    }

    await user.save();

    return res.status(200).json({
      code: 200,
      message: "Track view success",
    });
  } catch (error) {
    console.error("trackView error:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};

export const getSuggestedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "newest" } = req.query;
    const now = new Date();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?._id || req.user?.id;
    const pageSize = parseInt(limit);

    let suggestedIds = [];

    if (userId) {
      try {
        const aiUrl = `http://127.0.0.1:8000/recommend/${userId}`;
        const aiResponse = await axios.get(aiUrl, { timeout: 3000 }).catch(() => null);

        if (aiResponse?.data) {
            console.log(`[AI_LOG] User: ${userId}`);
            console.log(`[AI_LOG] IDs nhận được: ${JSON.stringify(aiResponse.data.data?.map(p => p._id) || aiResponse.data.recommendations)}`);
        } else {
            console.log(`[AI_LOG] ⚠️ Không nhận được phản hồi từ AI, dùng fallback Category.`);
        }
        if (aiResponse?.data?.data) {
          suggestedIds = aiResponse.data.data.map(p => p._id.toString());
        } else if (aiResponse?.data?.recommendations) {
          suggestedIds = aiResponse.data.recommendations.map(id => id.toString());
        }
      } catch (err) {
        console.error("AI Suggestion Fetch Error:", err.message);
      }
    }

    let categoryIds = [];
    if (suggestedIds.length === 0 && userId) {
      const user = await User.findById(userId).select("viewHistory").lean();
      if (user?.viewHistory) {
        categoryIds = user.viewHistory.slice(0, 5).map(item => item.categoryId.toString());
      }
    }

    const match = { isActive: true, isSpecialty: false };

    if (suggestedIds.length > 0) {
      match._id = { $in: suggestedIds.map(id => new mongoose.Types.ObjectId(id)) };
    } else if (categoryIds.length > 0) {
      match.categoryId = { $in: categoryIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { finalPrice: 1 },
      price_desc: { finalPrice: -1 },
      sold_desc: { soldCount: -1 }
    };

    const aiIdObjects = suggestedIds.map(id => new mongoose.Types.ObjectId(id));

    const results = await Product.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "saleitems",
          localField: "salePercent",
          foreignField: "_id",
          as: "sale",
        },
      },
      { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          aiOrder: { $indexOfArray: [aiIdObjects, "$_id"] },
          isPromotion: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sale.percent", false] },
                  { $lte: ["$sale.startDate", now] },
                  { $gte: ["$sale.endDate", now] },
                ],
              },
              1, 0,
            ],
          },
          salePercent: {
            $cond: [
              { $eq: ["$isPromotion", 1] },
              {
                percent: "$sale.percent",
                startDate: "$sale.startDate",
                endDate: "$sale.endDate",
              },
              null,
            ],
          },
          finalPrice: {
            $cond: [
              { $eq: ["$isPromotion", 1] },
              { $multiply: ["$price", { $divide: [{ $subtract: [100, "$sale.percent"] }, 100] }] },
              "$price",
            ],
          },
        },
      },
      { 
        $sort: suggestedIds.length > 0 
          ? { aiOrder: 1 } 
          : (sortMap[sort] || sortMap.sold_desc) 
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: pageSize },
            {
              $lookup: {
                from: "categories",
                localField: "categoryId",
                foreignField: "_id",
                as: "categoryId",
              },
            },
            { $unwind: "$categoryId" },
            { $project: { sale: 0, isPromotion: 0, aiOrder: 0 } },
          ],
        },
      },
    ]);

    const totalItems = results[0].metadata[0]?.total || 0;
    const products = results[0].data;

    return res.status(200).json({
      code: 200,
      data: products,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: parseInt(page),
        pageSize,
        hasNextPage: skip + products.length < totalItems
      }
    });

  } catch (error) {
    console.error("getSuggestedProducts error:", error);
    return res.status(500).json({ code: 500, message: "Internal server error" });
  }
};
export const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId, sort = "newest" } = req.query;

    const match = { 
        isActive: true, 
        isSpecialty: false
     };

    if (categoryId) {
      match.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { finalPrice: 1 },
      price_desc: { finalPrice: -1 },
      sold_desc: { soldCount: -1 },
    };

    const products = await Product.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "saleitems",
          localField: "salePercent",
          foreignField: "_id",
          as: "sale",
        },
      },
      {
        $unwind: {
          path: "$sale",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $addFields: {
          salePercent: {
            $cond: [
              { $ifNull: ["$sale", false] },
              {
                percent: "$sale.percent",
                startDate: "$sale.startDate",
                endDate: "$sale.endDate",
              },
              null,
            ],
          },
          finalPrice: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sale.percent", false] },
                  { $lte: ["$sale.startDate", new Date()] },
                  { $gte: ["$sale.endDate", new Date()] },
                ],
              },
              {
                $multiply: [
                  "$price",
                  {
                    $divide: [{ $subtract: [100, "$sale.percent"] }, 100],
                  },
                ],
              },
              "$price",
            ],
          },
        },
      },

      { $sort: sortMap[sort] || sortMap.newest },

      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryId",
        },
      },
      { $unwind: "$categoryId" },

      {
        $project: {
          sale: 0,
        },
      },
    ]);

    return res.status(200).json({
      code: 200,
      data: products,
    });
  } catch (error) {
    console.error("getProductsByCategory error:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};
export const getAllProductAdmin = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("categoryId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      code: 200,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Get all products error:", error.message);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
};
export const getProductsByRegion = async (req, res) => {
  try {
    const { region, categoryId, sort = "newest", page = 1, limit = 10 } = req.query;
    const now = new Date();
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const pageSize = parseInt(limit);

    if (!["bac", "trung", "nam"].includes(region)) {
      return res.status(400).json({
        code: 400,
        message: "Region must be bac | trung | nam",
      });
    }

    const match = {
      region,
      isActive: true,
      isSpecialty: false
    };

    if (categoryId) {
      match.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { finalPrice: 1 },
      price_desc: { finalPrice: -1 },
      sold_desc: { soldCount: -1 },
      sale: { isPromotion: -1, soldCount: -1 }
    };

    const results = await Product.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "saleitems",
          localField: "salePercent",
          foreignField: "_id",
          as: "sale",
        },
      },
      {
        $unwind: {
          path: "$sale",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          isPromotion: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sale.percent", false] },
                  { $lte: ["$sale.startDate", now] },
                  { $gte: ["$sale.endDate", now] },
                ],
              },
              1,
              0,
            ],
          },
          salePercent: {
            $cond: [
              { $ifNull: ["$sale", false] },
              {
                percent: "$sale.percent",
                startDate: "$sale.startDate",
                endDate: "$sale.endDate",
              },
              null,
            ],
          },
          finalPrice: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sale.percent", false] },
                  { $lte: ["$sale.startDate", now] },
                  { $gte: ["$sale.endDate", now] },
                ],
              },
              {
                $multiply: [
                  "$price",
                  {
                    $divide: [{ $subtract: [100, "$sale.percent"] }, 100],
                  },
                ],
              },
              "$price",
            ],
          },
        },
      },
      { $sort: sortMap[sort] || sortMap.newest },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: pageSize },
            {
              $lookup: {
                from: "categories",
                localField: "categoryId",
                foreignField: "_id",
                as: "categoryId",
              },
            },
            { $unwind: "$categoryId" },
            {
              $project: {
                sale: 0,
                isPromotion: 0,
              },
            },
          ],
        },
      },
    ]);

    const totalItems = results[0].metadata[0]?.total || 0;
    const products = results[0].data;

    return res.status(200).json({
      code: 200,
      data: products,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: parseInt(page),
        pageSize,
        hasNextPage: skip + products.length < totalItems
      }
    });
  } catch (error) {
    console.error("getProductsByRegion error:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};

export const getProductsSpecialByRegion = async (req, res) => {
  try {
    const { region, sort = "newest" } = req.query;

    const match = {
      isActive: true,
      isSpecialty: true
    };

    if (region && region !== "all") {
      if (!["bac", "trung", "nam"].includes(region)) {
        return res.status(400).json({
          code: 400,
          message: "Region must be bac | trung | nam | all",
        });
      }
      match.region = region;
    }

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { finalPrice: 1 },
      price_desc: { finalPrice: -1 },
      sold_desc: { soldCount: -1 },
    };

    const products = await Product.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "saleitems",
          localField: "salePercent",
          foreignField: "_id",
          as: "sale",
        },
      },
      {
        $unwind: {
          path: "$sale",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $addFields: {
          salePercent: {
            $cond: [
              { $ifNull: ["$sale", false] },
              {
                percent: "$sale.percent",
                startDate: "$sale.startDate",
                endDate: "$sale.endDate",
              },
              null,
            ],
          },
          finalPrice: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sale.percent", false] },
                  { $lte: ["$sale.startDate", new Date()] },
                  { $gte: ["$sale.endDate", new Date()] },
                ],
              },
              {
                $multiply: [
                  "$price",
                  {
                    $divide: [{ $subtract: [100, "$sale.percent"] }, 100],
                  },
                ],
              },
              "$price",
            ],
          },
        },
      },

      { $sort: sortMap[sort] || sortMap.newest },

      {
        $project: {
          sale: 0,
        },
      },
    ]);

    return res.status(200).json({
      code: 200,
      data: products,
    });
  } catch (error) {
    console.error("getProductsSpecialByRegion error:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};

export const getLatestSpecialtyProduct = async (req, res) => {
  try {
    const now = new Date();

    const specialtyProduct = await Product.findOne({
      isSpecialty: true,
      isActive: true,
    })
      .populate({
        path: "salePercent",
        match: { startDate: { $lte: now }, endDate: { $gte: now } },
        select: "percent",
      })
      .populate("categoryId", "name slug")
      .sort({ createdAt: -1 })
      .lean();

    if (!specialtyProduct) {
      return res.status(404).json({
        code: 404,
        message: "Không tìm thấy sản phẩm đặc sản nào",
        data: null,
      });
    }

    return res.status(200).json({
      code: 200,
      data: specialtyProduct,
    });
  } catch (error) {
    console.error("getLatestSpecialtyProduct error:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};

export const getProductsByFilter = async (req, res) => {
  try {
    const { sort } = req.query;
    const now = new Date();

    const filter = {
      isActive: true,
      isSpecialty: false
    };

    let sortOption = { createdAt: -1 }; 

    switch (sort) {
      case "price_asc":
        sortOption = { price: 1 };
        break;
      case "price_desc":
        sortOption = { price: -1 };
        break;
      case "sold_desc":
        sortOption = { soldCount: -1 };
        break;
      case "sale":
        sortOption = { soldCount: -1 }; 
        break;
      case "newest":
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    let products = await Product.find(filter)
      .populate({
        path: "salePercent",
        match: { startDate: { $lte: now }, endDate: { $gte: now } },
        select: "percent"
      })
      .populate("categoryId", "name slug")
      .sort(sortOption);

    if (sort === "sale") {
      const withSale = products.filter(p => p.salePercent);
      const withoutSale = products.filter(p => !p.salePercent);
      products = [...withSale, ...withoutSale];
    }

    return res.status(200).json({
      code: 200,
      data: products,
    });
  } catch (error) {
    console.error("getProductsByFilter error:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};

export const getProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ code: 400, message: "Invalid product id" });
    }

    const checkProduct = await Product.findById(id).select("isSpecialty");
    if (!checkProduct) {
      return res.status(404).json({ code: 404, message: "Product not found" });
    }

    const productId = new mongoose.Types.ObjectId(id);

    const pipeline = [
      {
        $match: {
          _id: productId,
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "saleitems",
          localField: "salePercent",
          foreignField: "_id",
          as: "sale",
        },
      },
      {
        $unwind: { path: "$sale", preserveNullAndEmptyArrays: true },
      },
      {
        $addFields: {
          salePercent: {
            $cond: [
              { $ifNull: ["$sale", false] },
              {
                percent: "$sale.percent",
                startDate: "$sale.startDate",
                endDate: "$sale.endDate",
              },
              null,
            ],
          },
          finalPrice: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sale.percent", false] },
                  { $lte: ["$sale.startDate", new Date()] },
                  { $gte: ["$sale.endDate", new Date()] },
                ],
              },
              {
                $multiply: [
                  "$price",
                  { $divide: [{ $subtract: [100, "$sale.percent"] }, 100] },
                ],
              },
              "$price",
            ],
          },
        },
      },
    ];

    if (!checkProduct.isSpecialty) {
      pipeline.push(
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "categoryId",
          },
        },
        { $unwind: { path: "$categoryId", preserveNullAndEmptyArrays: true } }
      );
    }

    pipeline.push(
      {
        $lookup: {
          from: "ingredients",
          localField: "_id",
          foreignField: "productId",
          as: "mappedIngredients",
        },
      },
      {
        $lookup: {
          from: "recipes",
          let: { 
            pId: "$_id", 
            mappedIngIds: "$mappedIngredients._id" 
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$isDeleted", false] },
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: "$ingredients",
                              as: "ing",
                              cond: {
                                $or: [
                                  {
                                    $and: [
                                      { $eq: ["$$ing.itemType", "Product"] },
                                      { $eq: ["$$ing.ingredientId", "$$pId"] }
                                    ]
                                  },
                                  {
                                    $and: [
                                      { $eq: ["$$ing.itemType", "Ingredient"] },
                                      { $in: ["$$ing.ingredientId", "$$mappedIngIds"] }
                                    ]
                                  }
                                ]
                              }
                            }
                          }
                        },
                        0
                      ]
                    }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: "categoryrecipes",
                localField: "category",
                foreignField: "_id",
                as: "category",
              },
            },
            { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
            { $sort: { createdAt: -1 } },
          ],
          as: "relatedRecipes",
        },
      },
      {
        $project: {
          sale: 0,
          mappedIngredients: 0,
        },
      }
    );

    const products = await Product.aggregate(pipeline);
    
    if (products && products.length > 0) {
      const currentProductId = products[0]._id.toString();
      
      if (req.user && req.user.id) {
        triggerAIUpdate(req.user.id, currentProductId);
      }
    }

    return res.status(200).json({
      code: 200,
      data: products[0] || null,
    });
  } catch (error) {
    console.error("getProductDetail error:", error);
    return res.status(500).json({ code: 500, message: "Internal server error" });
  }
};

import { generateVietnameseRegex } from "../utils/regexLanguage.js";

export const searchProducts = async (req, res) => {
  try {
    const { q, sort = "newest" } = req.query;
    
    if (!q || !q.trim()) {
      return res.status(200).json({ code: 200, data: [] });
    }

    const keyword = q.trim();
    const viRegexPattern = generateVietnameseRegex(keyword).source; 

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { finalPrice: 1 },
      price_desc: { finalPrice: -1 },
      sold_desc: { soldCount: -1 },
    };

    const pipeline = [
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { 
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true 
        } 
      },
      {
        $lookup: {
          from: "saleitems",
          localField: "salePercent",
          foreignField: "_id",
          as: "sale",
        },
      },
      {
        $unwind: { path: "$sale", preserveNullAndEmptyArrays: true },
      },
      {
        $addFields: {
          finalPrice: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sale.percent", false] },
                  { $lte: ["$sale.startDate", new Date()] },
                  { $gte: ["$sale.endDate", new Date()] },
                ],
              },
              {
                $multiply: [
                  "$price",
                  { $divide: [{ $subtract: [100, "$sale.percent"] }, 100] },
                ],
              },
              "$price",
            ],
          },
        },
      },
      {
        $addFields: {
          nameMatch: { 
            $regexMatch: { input: "$name", regex: viRegexPattern, options: "i" } 
          },
          categoryMatch: {
            $cond: [
              { $ifNull: ["$category.name", false] },
              { $regexMatch: { input: "$category.name", regex: viRegexPattern, options: "i" } },
              false
            ]
          },
          originMatch: {
            $cond: [
              { $ifNull: ["$origin", false] },
              { $regexMatch: { input: "$origin", regex: viRegexPattern, options: "i" } },
              false
            ]
          }
        },
      },
      {
        $match: {
          $or: [
            { nameMatch: true }, 
            { categoryMatch: true },
            { originMatch: true }
          ],
        },
      },
    ];

    if (sort === "newest") {
      pipeline.push(
        {
          $addFields: {
            priority: {
              $switch: {
                branches: [
                  { case: { $eq: ["$nameMatch", true] }, then: 1 },
                  { case: { $eq: ["$originMatch", true] }, then: 2 },
                ],
                default: 3
              }
            },
          },
        },
        { $sort: { priority: 1, createdAt: -1 } }
      );
    } else {
      pipeline.push({ $sort: sortMap[sort] || sortMap.newest });
    }

    pipeline.push(
      { $limit: 20 },
      {
        $project: {
          nameMatch: 0,
          categoryMatch: 0,
          originMatch: 0,
          priority: 0,
          sale: 0
        },
      }
    );
    if (req.user && req.user.id) {
      triggerAIUpdate(req.user.id)
    }

    const products = await Product.aggregate(pipeline);
    return res.status(200).json({ code: 200, data: products });

  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ code: 500, message: "Internal server error" });
  }
};

export const previewCheckout = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        code: 400,
        message: "Danh sách sản phẩm không hợp lệ",
      });
    }

    const productIds = items.map(i => {
      if (!mongoose.Types.ObjectId.isValid(i.productId)) {
        throw new Error("Invalid product id");
      }
      return new mongoose.Types.ObjectId(i.productId);
    });

    const products = await Product.aggregate([
      {
        $match: {
          _id: { $in: productIds },
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "saleitems",
          localField: "salePercent",
          foreignField: "_id",
          as: "sale",
        },
      },
      {
        $unwind: {
          path: "$sale",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          salePercent: {
            $cond: [
              { $ifNull: ["$sale", false] },
              {
                percent: "$sale.percent",
                startDate: "$sale.startDate",
                endDate: "$sale.endDate",
              },
              null,
            ],
          },
          finalPrice: {
            $round: [
              {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ["$sale.percent", false] },
                      { $lte: ["$sale.startDate", new Date()] },
                      { $gte: ["$sale.endDate", new Date()] },
                    ],
                  },
                  {
                    $multiply: [
                      "$price",
                      {
                        $divide: [
                          { $subtract: [100, "$sale.percent"] },
                          100,
                        ],
                      },
                    ],
                  },
                  "$price",
                ],
              },
              0 
            ],
          },
        },
      },
      {
        $project: {
          sale: 0,
        },
      },
    ]);

    if (products.length !== items.length) {
      return res.status(400).json({
        code: 400,
        message: "Một số sản phẩm không tồn tại hoặc đã ngừng kinh doanh",
      });
    }

    let totalAmount = 0;
    
    const checkoutItems = items.map(item => {
      const product = products.find(
        p => p._id.toString() === item.productId
      );

      const qty = Math.ceil(Number(item.quantity) || 0); 
      
      const itemTotal = product.finalPrice * qty;
      totalAmount += itemTotal;

      return {
        productId: product._id,
        name: product.name,
        price: product.price,
        sale: product.salePercent,
        finalPrice: product.finalPrice,
        quantity: qty,
        total: itemTotal,
      };
    });

    return res.status(200).json({
      code: 200,
      data: {
        items: checkoutItems,
        totalAmount: Math.round(totalAmount), 
      },
    });
  } catch (error) {
    console.error("previewCheckout error:", error);
    return res.status(500).json({
      code: 500,
      message: error.message || "Internal server error",
    });
  }
};

export const getNormalProducts = async (req, res) => {
    try {
        const products = await Product.find({ isSpecialty: false, isActive: true })
            .populate('categoryId', 'name')
            .populate('salePercent')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách sản phẩm thường',
            error: error.message
        });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        let updateData = { ...req.body };
        console.log(updateData.salePercent);
        

        const parseField = (field) => {
            if (typeof field === 'string') {
                try {
                    return JSON.parse(field);
                } catch (e) {
                    return field; 
                }
            }
            return field;
        };

        if (req.body.nutrition) updateData.nutrition = parseField(req.body.nutrition);
        if (req.body.season) updateData.season = parseField(req.body.season);
        if (req.body.usage_instruction) updateData.usage_instruction = parseField(req.body.usage_instruction);

        if (req.files && req.files.length > 0) {
            updateData.images = req.files.map(file => file.path);
        }

        if (!updateData.salePercent || updateData.salePercent === '' || updateData.salePercent === 'null' || updateData.salePercent === 'undefined') {
            updateData.salePercent = null;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm để cập nhật'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật thành công',
            data: updatedProduct
        });

    } catch (error) {
        console.error("LỖI UPDATE:", error); 
        res.status(500).json({ success: false, error: error.message });
    }
};