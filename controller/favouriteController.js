import { Favourite } from "../models/favouriteModel.js";
import { FavouriteItem } from "../models/favouriteItem.js";
import mongoose from "mongoose";
export const addToFavourite = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "ProductId is required" });
    }

    let favourite = await Favourite.findOne({ userId });

    if (!favourite) {
      favourite = await Favourite.create({ userId });
    }

    const existedItem = await FavouriteItem.findOne({
      favouriteId: favourite._id,
      productId,
    });

    if (!existedItem) {
        await FavouriteItem.create({
          favouriteId: favourite._id,
          productId,
        });
    } else {
      return res.status(200).json({favourite})
    }

    return res.status(200).json({
      code: 200,
      message: "Add to favourite successfully",
    });
  } catch (error) {
    console.error("Add to favourite error:", error.message);
    return res.status(500).json({ error: "Internal server" });
  }
};

export const getFavourite = async (req, res) => {
  try {
    const userId = req.user.id;

    const favourite = await Favourite.findOne({ userId });
    if (!favourite) {
      return res.status(200).json({
        code: 200,
        data: [],
      });
    }

    const items = await FavouriteItem.aggregate([
      {
        $match: {
          favouriteId: new mongoose.Types.ObjectId(favourite._id),
        },
      },

      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },

      {
        $lookup: {
          from: "saleitems",
          localField: "product.salePercent",
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
                  "$product.price",
                  {
                    $divide: [{ $subtract: [100, "$sale.percent"] }, 100],
                  },
                ],
              },
              "$product.price",
            ],
          },
        },
      },

      {
        $project: {
          _id: 1,
          product: {
            _id: "$product._id",
            name: "$product.name",
            price: "$product.price",
            images: "$product.images",
            categoryId: "$product.categoryId",
            finalPrice: "$finalPrice",
            salePercent: "$sale.percent",
          },
          createdAt: 1,
        },
      },
    ]);

    return res.status(200).json({
      code: 200,
      data: items,
    });
  } catch (error) {
    console.error("Get favourite error:", error);
    return res.status(500).json({ error: "Internal server" });
  }
};

export const removeItemsFromFavourite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: "productIds must be a non-empty array",
      });
    }

    const favourite = await Favourite.findOne({ userId });
    if (!favourite) {
      return res.status(200).json({
        code: 200,
        message: "Favourite is empty",
      });
    }

    await FavouriteItem.deleteMany({
      favouriteId: favourite._id,
      productId: {
        $in: productIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    });

    return res.status(200).json({
      code: 200,
      message: "Remove favourite items successfully",
    });
  } catch (error) {
    console.error("Remove favourite items error:", error.message);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};
