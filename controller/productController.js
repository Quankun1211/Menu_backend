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

    const limit = 4;

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

    const validProducts = products
      .filter(p => p.salePercent)

    return res.status(200).json({
      code: 200,
      data: {
        data: validProducts
      },
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
    const now = new Date();
    const userId = req.user?.id;
    let suggestedCategoryIds = new Set();

    if (userId) {
      const [user, myRecipes, favourite] = await Promise.all([
        User.findById(userId)
          .populate({
            path: "savedRecipes",
            select: "ingredients",
          })
          .lean(),
        Recipe.find({ creatorId: userId }).select("ingredients").lean(),
        Favourite.findOne({ userId: userId }).select("_id").lean(),
      ]);

      if (user?.viewHistory?.length) {
        user.viewHistory
          .sort((a, b) => b.viewCount - a.viewCount || new Date(b.lastViewedAt) - new Date(a.lastViewedAt))
          .slice(0, 2)
          .forEach(item => {
            if (item.categoryId) suggestedCategoryIds.add(item.categoryId.toString());
          });
      }

      if (favourite) {
        const favItems = await FavouriteItem.find({ favouriteId: favourite._id })
          .populate({
            path: "productId",
            select: "categoryId",
          })
          .lean();

        favItems.forEach(item => {
          if (item.productId?.categoryId) {
            suggestedCategoryIds.add(item.productId.categoryId.toString());
          }
        });
      }

      const allIngredients = [
        ...(myRecipes?.flatMap(r => r.ingredients || []) || []),
        ...(user?.savedRecipes?.flatMap(r => r.ingredients || []) || [])
      ];

      const validIngredientNames = allIngredients
        .filter(i => i && typeof i.name === 'string')
        .map(i => i.name.trim())
        .filter(name => name.length > 0);

      const uniqueIngredientNames = [...new Set(validIngredientNames)];

      if (uniqueIngredientNames.length > 0) {
        const productsFromIngredients = await Product.find({
          name: { $in: uniqueIngredientNames.map(name => new RegExp(name, "i")) },
          isActive: true
        }).select("categoryId").lean();

        productsFromIngredients.forEach(p => {
          if (p.categoryId) suggestedCategoryIds.add(p.categoryId.toString());
        });
      }
    }

    let products = [];
    if (suggestedCategoryIds.size > 0) {
      products = await Product.find({
        categoryId: { $in: Array.from(suggestedCategoryIds) },
        isActive: true,
        isSpecialty: false
      })
      .populate({
        path: "salePercent",
        match: { startDate: { $lte: now }, endDate: { $gte: now } },
        select: "percent startDate endDate",
      })
      .populate("categoryId", "name slug")
      .sort({ soldCount: -1, viewCount: -1 })
      .limit(20);
    }

    if (products.length < 8) {
      const excludeIds = products.map(p => p._id);
      const fallbackProducts = await Product.find({
        _id: { $nin: excludeIds },
        isActive: true,
        isSpecialty: false
      })
      .populate({
        path: "salePercent",
        match: { startDate: { $lte: now }, endDate: { $gte: now } },
        select: "percent startDate endDate",
      })
      .populate("categoryId", "name slug")
      .sort({ soldCount: -1, viewCount: -1 })
      .limit(20);

      products = [...products, ...fallbackProducts];
    }

    const uniqueProducts = Array.from(
      new Map(products.map((p) => [p._id.toString(), p])).values()
    ).slice(0, 20);

    return res.status(200).json({
      code: 200,
      data: uniqueProducts,
    });
  } catch (error) {
    console.error("getSuggestedProducts error:", error);
    return res.status(500).json({
      code: 500,
      data: [],
    });
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
    const { region, categoryId, sort = "newest" } = req.query;
    const now = new Date();

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

    // Định nghĩa logic sort mặc định cho các case thông thường
    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { finalPrice: 1 },
      price_desc: { finalPrice: -1 },
      sold_desc: { soldCount: -1 },
      sale: { isPromotion: -1, soldCount: -1 } // Sale đứng đầu, sau đó đến bán chạy
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
          // Kiểm tra xem sản phẩm có đang trong chương trình sale hợp lệ không
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
      // Sắp xếp theo cấu hình sortMap
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
          isPromotion: 0, // Ẩn trường bổ trợ khi trả về kết quả
        },
      },
    ]);

    return res.status(200).json({
      code: 200,
      data: products,
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
      return res.status(400).json({
        code: 400,
        message: "Invalid product id",
      });
    }

    const checkProduct = await Product.findById(id).select("isSpecialty");
    if (!checkProduct) {
      return res.status(404).json({ code: 404, message: "Product not found" });
    }

    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
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
        { $unwind: "$categoryId" }
      );
    }

    pipeline.push(
      {
        $lookup: {
          from: "ingredients",
          localField: "_id",
          foreignField: "productId",
          as: "relatedIngredientDocs",
        },
      },
      {
        $lookup: {
          from: "recipes",
          let: { ingIds: "$relatedIngredientDocs._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $gt: [{ $size: { $setIntersection: ["$ingredients", "$$ingIds"] } }, 0],
                },
              },
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
          relatedIngredientDocs: 0,
        },
      }
    );

    const products = await Product.aggregate(pipeline);

    return res.status(200).json({
      code: 200,
      data: products[0],
    });
  } catch (error) {
    console.error("getProductDetail error:", error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
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
    const viRegex = generateVietnameseRegex(keyword); 

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { finalPrice: 1 },
      price_desc: { finalPrice: -1 },
      sold_desc: { soldCount: -1 },
    };

    const pipeline = [
      {
        $match: {
          isActive: true,
        },
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
          nameMatch: { $regexMatch: { input: "$name", regex: viRegex } },
          categoryMatch: {
            $cond: [
              { $ifNull: ["$category.name", false] },
              { $regexMatch: { input: "$category.name", regex: viRegex } },
              false
            ]
          },
          originMatch: {
            $cond: [
              { $ifNull: ["$origin", false] },
              { $regexMatch: { input: "$origin", regex: viRegex } },
              false
            ]
          }
        },
      },

      {
        $match: {
          isActive: true,
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
        message: "Một số sản phẩm không tồn tại",
      });
    }

    let totalAmount = 0;
    
    items.map(item => {
      console.log(item.productId);
    })
    const checkoutItems = items.map(item => {
      const product = products.find(
        p => p._id.toString() === item.productId
      );

      const itemTotal = product.finalPrice * item.quantity;
      totalAmount += itemTotal;

      return {
        productId: product._id,
        name: product.name,
        price: product.price,
        sale: product.salePercent,
        finalPrice: product.finalPrice,
        quantity: item.quantity,
        total: itemTotal,
      };
    });

    return res.status(200).json({
      code: 200,
      data: {
        items: checkoutItems,
        totalAmount,
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