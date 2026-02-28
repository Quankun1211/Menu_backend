import { SaleItem } from "../models/saleItemModel.js";

export const getSaleItems = async (req, res) => {
  try {
    const now = new Date();

    const sales = await SaleItem.find({
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ percent: -1 });

    return res.status(200).json({
      success: true,
      count: sales.length,
      data: sales
    });
  } catch (error) {
    console.error("Get SaleItems error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const getAllSalesAdmin = async (req, res) => {
  try {
    const sales = await SaleItem.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: sales
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching all sales" });
  }
};