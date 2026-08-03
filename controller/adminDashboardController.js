import { Order } from "../models/ordersModel.js";
import { OrderItem } from "../models/orderItemsModel.js";
import { Product } from "../models/productsModel.js";
import { Special } from "../models/specialModel.js";
import { User } from "../models/userModel.js";
import { Menu } from "../models/menuModels/menuModel.js";
import { Recipe } from "../models/menuModels/RecipeModel.js";

const invalidPaymentStatuses = ["failed", "cancelled", "refunded"];
const revenueOrderStatuses = ["delivered", "completed"];

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const percentageChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const localDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const revenueExpression = {
  $cond: [
    {
      $and: [
        { $in: ["$status", revenueOrderStatuses] },
        { $not: [{ $in: ["$paymentStatus", invalidPaymentStatuses] }] },
      ],
    },
    "$totalPrice",
    0,
  ],
};

const fillDailySeries = (rows, start, days) => {
  const values = new Map(rows.map((row) => [row._id, row]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const key = localDateKey(date);
    return {
      date: key,
      orders: values.get(key)?.orders || 0,
      revenue: values.get(key)?.revenue || 0,
    };
  });
};

const aggregatePeriod = (from, to) => {
  const dateFilter = to ? { $gte: from, $lt: to } : { $gte: from };
  return Order.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: revenueExpression },
        revenueOrders: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", revenueOrderStatuses] },
                  { $not: [{ $in: ["$paymentStatus", invalidPaymentStatuses] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
        customers: { $addToSet: "$userId" },
      },
    },
  ]);
};

export const getDashboardOverview = async (req, res) => {
  try {
    const requestedPeriod = Number(req.query.period);
    const period = [7, 30, 90].includes(requestedPeriod) ? requestedPeriod : 30;
    const now = new Date();
    const currentStart = startOfDay(now);
    currentStart.setDate(currentStart.getDate() - period + 1);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - period);

    const [
      currentMetrics,
      previousMetrics,
      statusRows,
      dailyRows,
      recentOrders,
      topProducts,
      inventory,
      catalog,
    ] = await Promise.all([
      aggregatePeriod(currentStart),
      aggregatePeriod(previousStart, currentStart),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: currentStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+07:00" } },
            orders: { $sum: 1 },
            revenue: { $sum: revenueExpression },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.find()
        .select("userId totalPrice status paymentMethod paymentStatus createdAt")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      OrderItem.aggregate([
        {
          $lookup: {
            from: Order.collection.name,
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        { $match: { "order.status": { $in: revenueOrderStatuses } } },
        {
          $group: {
            _id: { productId: "$productId", itemType: "$itemType" },
            name: { $first: "$productName" },
            image: { $first: "$productImage" },
            quantity: { $sum: "$quantity" },
            revenue: { $sum: { $multiply: ["$price", "$quantity"] } },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
      ]),
      Promise.all([
        Product.countDocuments({ isActive: true, stock: 0 }),
        Special.countDocuments({ isActive: true, stock: 0 }),
        Product.countDocuments({ isActive: true, stock: { $gt: 0, $lte: 10 } }),
        Special.countDocuments({ isActive: true, stock: { $gt: 0, $lte: 10 } }),
        Product.countDocuments({ isActive: true }),
        Special.countDocuments({ isActive: true }),
      ]),
      Promise.all([
        User.countDocuments({ role: "user", isActive: true }),
        User.countDocuments({ role: "shipper", isActive: true }),
        Menu.countDocuments({ isDeleted: false }),
        Recipe.countDocuments({ isDeleted: false, isSystem: true }),
      ]),
    ]);

    const current = currentMetrics[0] || { orders: 0, revenue: 0, revenueOrders: 0, customers: [] };
    const previous = previousMetrics[0] || { orders: 0, revenue: 0, revenueOrders: 0, customers: [] };
    const [outProducts, outSpecials, lowProducts, lowSpecials, products, specials] = inventory;
    const [customers, shippers, menus, recipes] = catalog;
    const currentCustomers = current.customers.filter(Boolean).length;
    const previousCustomers = previous.customers.filter(Boolean).length;

    return res.status(200).json({
      success: true,
      data: {
        period,
        generatedAt: now,
        summary: {
          revenue: current.revenue,
          orders: current.orders,
          activeCustomers: currentCustomers,
          averageOrderValue: current.revenueOrders ? Math.round(current.revenue / current.revenueOrders) : 0,
          growth: {
            revenue: percentageChange(current.revenue, previous.revenue),
            orders: percentageChange(current.orders, previous.orders),
            activeCustomers: percentageChange(currentCustomers, previousCustomers),
          },
        },
        orderStatuses: Object.fromEntries(statusRows.map((row) => [row._id, row.count])),
        daily: fillDailySeries(dailyRows, currentStart, period),
        recentOrders,
        topProducts,
        inventory: {
          total: products + specials,
          lowStock: lowProducts + lowSpecials,
          outOfStock: outProducts + outSpecials,
        },
        catalog: { customers, shippers, products, specials, menus, recipes },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Không thể tải dữ liệu bảng điều khiển",
      error: error.message,
    });
  }
};
