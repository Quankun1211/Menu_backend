import { CartItems } from "../models/cartsItemModel.js";
import { Cart } from "../models/cartsModel.js";
import mongoose from "mongoose";
import { triggerAIUpdate } from "../utils/trackingUserBehavior.js";
import { Product } from "../models/productsModel.js";
import { Special } from "../models/specialModel.js";

export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { productId, quantity = 1 } = req.body;
    console.log("Add productID: ", productId);
    if (!productId) {
      return res.status(400).json({ message: "ProductId is required" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    const product = await Product.findOne({ _id: productId, isActive: true }).select("_id");
    const special = product ? null : await Special.findOne({ _id: productId, isActive: true }).select("_id");
    if (!product && !special) {
      return res.status(404).json({ message: "Product or special not found" });
    }
    const itemType = special ? "Special" : "Product";

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({ userId });
    }

    const existedItem = await CartItems.findOne({
      cartId: cart._id,
      productId,
      itemType,
    });

    if (existedItem) {
      existedItem.quantity += quantity;
      await existedItem.save();
    } else {
      await CartItems.create({
        cartId: cart._id,
        productId,
        itemType,
        quantity,
      });
    }
    if (req.user && req.user.id) {
      triggerAIUpdate(userId, productId.toString());
    }
    

    return res.status(200).json({
      code: 200,
      message: "Add to cart successfully",
    });
  } catch (error) {
    console.error("Add to cart error:", error.message);
    return res.status(500).json({ error: "Internal server" });
  }
};

export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(200).json({
        code: 200,
        data: {
          items: [],
          totalAmount: 0,
        },
      });
    }

    const result = await CartItems.aggregate([
      { $match: { cartId: new mongoose.Types.ObjectId(cart._id) } },

      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $lookup: {
          from: "specials",
          localField: "productId",
          foreignField: "_id",
          as: "special",
        },
      },
      {
        $addFields: {
          itemType: { $ifNull: ["$itemType", "Product"] },
          product: {
            $cond: [
              { $eq: [{ $ifNull: ["$itemType", "Product"] }, "Special"] },
              { $arrayElemAt: ["$special", 0] },
              { $arrayElemAt: ["$product", 0] },
            ],
          },
        },
      },
      { $match: { product: { $ne: null } } },

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
        $addFields: {
          itemTotal: { $multiply: ["$quantity", "$finalPrice"] },
        },
      },

      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$itemTotal" },
          items: { $push: "$$ROOT" },
        },
      },
    ]);

    return res.status(200).json({
      code: 200,
      data: {
        items: result[0]?.items || [],
        totalAmount: result[0]?.totalAmount || 0,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({ error: "Internal server" });
  }
};

export const removeItemsFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: "productIds must be a non-empty array",
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(200).json({
        code: 200,
        message: "Cart is empty",
      });
    }

    await CartItems.deleteMany({
      cartId: cart._id,
      productId: {
        $in: productIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    });

    return res.status(200).json({
      code: 200,
      message: "Remove cart items successfully",
    });
  } catch (error) {
    console.error("Remove cart items error:", error.message);
    return res.status(500).json({
      code: 500,
      message: "Internal server error",
    });
  }
};

export const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({
        code: 400,
        message: "Invalid payload",
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ code: 404, message: "Cart not found" });
    }

    const cartItem = await CartItems.findOneAndUpdate(
      {
        cartId: cart._id,
        productId, 
      },
      { quantity },
      { new: true }
    );

    if (!cartItem) {
      return res.status(404).json({
        code: 404,
        message: "Cart item not found",
      });
    }
    if (req.user && req.user.id) {
      triggerAIUpdate(userId, productId.toString());
    }

    return res.status(200).json({
      code: 200,
      data: cartItem,
    });
  } catch (error) {
    console.error("Update quantity error:", error.message);
    return res.status(500).json({ code: 500 });
  }
};

