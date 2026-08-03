import { Transaction } from "../models/transactionModel.js";

export const getTransactionsAdmin = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.paymentMethod && req.query.paymentMethod !== "all") {
      filter.paymentMethod = req.query.paymentMethod;
    }
    const [data, total] = await Promise.all([
      Transaction.find(filter)
        .populate("userId", "name email")
        .populate("orderId", "status paymentStatus refundStatus totalPrice")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
