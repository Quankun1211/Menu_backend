import { Order } from "../models/ordersModel.js";
import { User } from "../models/userModel.js"
import mongoose from 'mongoose';
import { Wallet } from "../models/walletSchema.js";
import { OrderItem } from "../models/orderItemsModel.js";
import { LevelReward } from "../models/levelModel.js";
import { RewardHistory } from "../models/rewardHistoryModel.js";
import { emitOrderUpdated } from "../utils/orderRealtime.js";

const attachOrderSummaries = async (orders) => {
    if (!orders.length) return orders;
    const items = await OrderItem.find({ orderId: { $in: orders.map((order) => order._id) } })
        .select("orderId productName quantity")
        .lean();
    const byOrder = new Map();
    for (const item of items) {
        const key = item.orderId.toString();
        if (!byOrder.has(key)) byOrder.set(key, []);
        byOrder.get(key).push(item);
    }
    return orders.map((order) => {
        const orderItems = byOrder.get(order._id.toString()) || [];
        const names = orderItems.map((item) => item.productName).filter(Boolean);
        return {
            ...order,
            itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
            productSummary: names.length > 2
                ? `${names.slice(0, 2).join(", ")} +${names.length - 2} món`
                : names.join(", "),
        };
    });
};

export const getShipperOrders = async (req, res) => {
    try {
        const shipperId = req.user._id;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const orders = await Order.aggregate([
            {
                $match: {
                    shipperId: shipperId,
                    $or: [
                        { status: { $in: ["confirmed", "processing", "shipping", "assigned", "pending_cancel"] } },
                        { 
                            status: { $in: ["delivered", "completed", "cancelled"] }, 
                            updatedAt: { $gte: startOfDay } 
                        }
                    ]
                }
            },
            {
                $addFields: {
                    statusPriority: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$status", "assigned"] }, then: 1 },
                                { case: { $eq: ["$status", "confirmed"] }, then: 2 },
                                { case: { $eq: ["$status", "shipping"] }, then: 3 },
                                { case: { $eq: ["$status", "pending_cancel"] }, then: 4 },
                                { case: { $in: ["$status", ["delivered", "completed"]] }, then: 5 },
                                { case: { $eq: ["$status", "cancelled"] }, then: 6 }
                            ],
                            default: 7
                        }
                    }
                }
            },
            { $sort: { statusPriority: 1, createdAt: -1 } },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userId"
                }
            },
            { $unwind: "$userId" },
            {
                $lookup: {
                    from: "addresses", // Đảm bảo tên collection address là đúng (thường là số nhiều)
                    localField: "address",
                    foreignField: "_id",
                    as: "address"
                }
            },
            { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    "userId.password": 0,
                    "userId.role": 0
                }
            }
        ]);

        const enrichedOrders = await attachOrderSummaries(orders);
        res.status(200).json({
            success: true,
            count: enrichedOrders.length,
            data: enrichedOrders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách đơn hàng",
            error: error.message
        });
    }
};

export const getAllShipperOrders = async (req, res) => {
    try {
        const shipperId = req.user._id;

        const orders = await Order.aggregate([
            { $match: { shipperId: shipperId } },
            {
                $addFields: {
                    statusPriority: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$status", "assigned"] }, then: 1 },
                                { case: { $eq: ["$status", "confirmed"] }, then: 2 },
                                { case: { $eq: ["$status", "shipping"] }, then: 3 },
                                { case: { $eq: ["$status", "pending_cancel"] }, then: 4 },
                                { case: { $in: ["$status", ["delivered", "completed"]] }, then: 5 },
                                { case: { $eq: ["$status", "cancelled"] }, then: 6 }
                            ],
                            default: 7
                        }
                    }
                }
            },
            { $sort: { statusPriority: 1, createdAt: -1 } },
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$userId" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                        { $project: { name: 1 } }
                    ],
                    as: "customer"
                }
            },
            { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "addresses",
                    localField: "address",
                    foreignField: "_id",
                    as: "address"
                }
            },
            { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } }
        ]);

        const enrichedOrders = await attachOrderSummaries(orders);
        res.status(200).json({
            success: true,
            count: enrichedOrders.length,
            data: enrichedOrders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách đơn hàng",
            error: error.message
        });
    }
};

export const processLevelUpAndRewards = async (userId, orderId, totalPrice, session) => {
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) return;

    let rewardRate = 0;
    if (totalPrice < 500000) {
        rewardRate = 0.01; 
    } else if (totalPrice < 2000000) {
        rewardRate = 0.02;
    } else {
        rewardRate = 0.03;
    }

    const earnedSeeds = Math.floor(totalPrice * rewardRate);
    if (earnedSeeds <= 0) return;

    wallet.goldSeeds += earnedSeeds;
    wallet.totalSeedsAccumulated += earnedSeeds;

    const calculatedLevel = Math.floor(Math.sqrt(wallet.totalSeedsAccumulated / 5000)) + 1;
    const newLevel = Math.min(calculatedLevel, 50);

    if (newLevel > wallet.level) {
        const oldLevel = wallet.level;
        
        for (let currentLv = oldLevel + 1; currentLv <= newLevel; currentLv++) {
            const isMilestone = [10, 20, 30, 40, 50].includes(currentLv);
            
            let reward = await LevelReward.findOne({ 
                rewardType: isMilestone ? 'milestone' : 'every_level', 
                ...(isMilestone && { milestoneLevel: currentLv })
            }).session(session);

            if (reward) {
                await RewardHistory.create([{
                    userId,
                    levelReached: currentLv,
                    rewardId: reward._id
                }], { session });
            }
        }

        wallet.level = newLevel;
        wallet.recentActivities.push({
            type: 'levelup',
            seeds: earnedSeeds,
            description: `Chúc mừng! Bạn đã thăng cấp lên Level ${newLevel}.`
        });
    } else {
        wallet.recentActivities.push({
            type: 'reward',
            seeds: earnedSeeds,
            orderId: orderId,
            description: `Tích lũy ${earnedSeeds} hạt (${(rewardRate * 100)}%) từ đơn hàng #${orderId.toString().slice(-6)}`
        });
    }

    await wallet.save({ session });
};
export const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, nextStatus } = req.body;
    const shipperId = req.user._id;

    const order = await Order.findOne({ _id: orderId, shipperId }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng hoặc bạn không có quyền xử lý đơn này."
      });
    }

    const currentStatus = order.status;
    let isValidTransition = false;

    if (nextStatus === "confirmed" && currentStatus === "assigned") {
      isValidTransition = true;
    } else if (nextStatus === "shipping" && (currentStatus === "confirmed" || currentStatus === "processing")) {
      isValidTransition = true;
      order.shippedAt = new Date();
    } else if (nextStatus === "delivered") {
      if (currentStatus === "shipping" && !order.isSeedRewarded) {
        isValidTransition = true;
        order.deliveredAt = new Date();
        order.isSeedRewarded = true;

        if (order.paymentMethod === 'cod' && order.paymentStatus !== 'paid') {
          order.paymentStatus = "paid";
          order.paidAt = new Date();
        }

        await processLevelUpAndRewards(order.userId, order._id, order.totalPrice, session);
      }
    }

    if (!isValidTransition) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Chuyển đổi trạng thái từ ${currentStatus} sang ${nextStatus} không hợp lệ.`
      });
    }

    order.status = nextStatus;
    await order.save({ session });
    await session.commitTransaction();

    const io = req.app.get('io');
    if (io) {
      emitOrderUpdated(io, order);
      io.to("admins").emit("admin_refresh_orders", { orderId: order._id });
      io.to(shipperId.toString()).emit("shipper_order_updated", { orderId: order._id, status: nextStatus });
    }

    res.status(200).json({
      success: true,
      message: `Cập nhật trạng thái đơn hàng thành ${nextStatus} thành công.`,
      data: order
    });

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("[shipper:update-status]", {
      orderId: req.body?.orderId,
      nextStatus: req.body?.nextStatus,
      shipperId: req.user?._id?.toString(),
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật trạng thái.",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

export const requestCancelOrder = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const shipperId = req.user._id;

        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp lý do hủy chi tiết (tối thiểu 10 ký tự)."
            });
        }

        const order = await Order.findOne({ _id: orderId, shipperId });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng hoặc bạn không có quyền xử lý đơn này."
            });
        }

        const allowedStatusForCancel = ["assigned", "confirmed"];
        if (!allowedStatusForCancel.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Không thể gửi yêu cầu hủy khi đơn hàng đang ở trạng thái: ${order.status}`
            });
        }

        order.status = "pending_cancel";
        order.cancelRequest = {
            reason: reason.trim(),
            requestedAt: new Date(),
            isAccepted: false
        };

        await order.save();
        const io = req.app.get('io');
        emitOrderUpdated(io, order);
        io.to("admins").emit("admin_refresh_orders", { orderId: order._id });
        res.status(200).json({
            success: true,
            message: "Yêu cầu hủy đơn đã được gửi. Vui lòng chờ Admin phê duyệt.",
            data: {
                orderId: order._id,
                status: order.status,
                requestDetails: order.cancelRequest
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi gửi yêu cầu hủy.",
            error: error.message
        });
    }
};

export const updateShipperStatus = async (req, res) => {
    try {
        const { isOnline } = req.body;
        const shipperId = req.user._id;

        if (typeof isOnline !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: "Trạng thái isOnline phải là giá trị boolean (true/false)"
            });
        }

        const shipper = await User.findOneAndUpdate(
            { _id: shipperId, role: "shipper" },
            { isOnline: isOnline },
            { new: true }
        );

        if (!shipper) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy shipper hoặc người dùng không có quyền"
            });
        }

        res.status(200).json({
            success: true,
            message: `Shipper hiện đang ${isOnline ? "Online" : "Offline"}`,
            data: {
                isOnline: shipper.isOnline
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi cập nhật trạng thái",
            error: error.message
        });
    }
};

export const updateShipperLocation = async (req, res) => {
  const { orderId, latitude, longitude } = req.body;
  const shipperId = req.user._id;

  const updatedOrder = await Order.findOneAndUpdate(
    { _id: orderId, shipperId, status: "shipping" },
    { 
      lastKnownLocation: { 
        latitude: parseFloat(latitude), 
        longitude: parseFloat(longitude) 
      } 
    },
    { new: true }
  );

  if (!updatedOrder) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy đơn đang giao thuộc quyền xử lý của bạn."
    });
  }

  req.app.get('io').to(`order:${orderId}`).emit('live_update', {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude)
  });

  res.status(200).json({ success: true });
};

export const getShipperStats = async (req, res) => {
  try {
    const shipperId = req.user._id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const orders = await Order.find({ shipperId, updatedAt: { $gte: startOfDay } })
      .select("status paymentMethod paymentStatus totalPrice shippedAt deliveredAt")
      .lean();

    const deliveredOrders = orders.filter((order) => order.status === "delivered");
    const deliveryDurations = deliveredOrders
      .filter((order) => order.shippedAt && order.deliveredAt)
      .map((order) => new Date(order.deliveredAt).getTime() - new Date(order.shippedAt).getTime());
    const averageDeliveryMinutes = deliveryDurations.length
      ? Math.round(deliveryDurations.reduce((sum, value) => sum + value, 0) / deliveryDurations.length / 60000)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        total: orders.length,
        active: orders.filter((order) => ["assigned", "confirmed", "processing", "shipping"].includes(order.status)).length,
        delivered: deliveredOrders.length,
        cancelled: orders.filter((order) => order.status === "cancelled").length,
        pendingCancel: orders.filter((order) => order.status === "pending_cancel").length,
        codCollected: deliveredOrders
          .filter((order) => order.paymentMethod === "cod" && order.paymentStatus === "paid")
          .reduce((sum, order) => sum + order.totalPrice, 0),
        averageDeliveryMinutes,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể tải thống kê shipper." });
  }
};

