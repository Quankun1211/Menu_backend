import slugify from "slugify";
import { Special } from "../models/specialModel.js";
import cloudinary from "../config/cloudinary.js";

export const createSpecialProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      unit,
      description,
      stock,
      salePercent,
      region,
      origin,
      originDescription,
      originFound,
      story,
      nutrition,
      usage_instruction,
      soldCount = 0,
      viewCount = 0,
      favouriteCount = 0,
      isActive = true
    } = req.body;

    const requiredFields = [
      name, price, unit, description, stock, 
      region, origin, originDescription, originFound, story
    ];

    if (requiredFields.some(field => !field)) {
      return res.status(400).json({ 
        message: "Missing required fields for Specialty Product" 
      });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const existedSpecial = await Special.findOne({ slug });
    if (existedSpecial) {
      return res.status(400).json({ message: "Special product with this name already exists" });
    }

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "specials"
      });
      imageUrl = uploadResult.secure_url;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const newSpecial = await Special.create({
      name,
      slug,
      price,
      unit,
      description,
      images: imageUrl,
      stock,
      salePercent: salePercent || null,
      region,
      origin,
      originDescription,
      originFound,
      story,
      nutrition: nutrition ? JSON.parse(nutrition) : {},
      usage_instruction: usage_instruction ? JSON.parse(usage_instruction) : [],
      soldCount,
      viewCount,
      favouriteCount,
      isActive
    });

    return res.status(201).json({
      code: 201,
      data: newSpecial
    });

  } catch (error) {
    console.error("Create Special Product error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getProductsSpecialByRegion = async (req, res) => {
  try {
    const { region, sort = "newest" } = req.query;

    const match = {
      isActive: true
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

    const products = await Special.aggregate([
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