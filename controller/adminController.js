import { Order } from "../models/ordersModel.js"; 
import { User } from "../models/userModel.js"; 
import { OrderItem } from "../models/orderItemsModel.js"
import { Product } from "../models/productsModel.js"
import { Special } from "../models/specialModel.js"
import { Category } from "../models/categoriesModel.js"
import { CategoryMenu } from "../models/menuModels/categoryMenuModel.js"
import { SaleItem } from "../models/saleItemModel.js";
import { CategoryRecipe } from "../models/RecipeModels/categoryRecipeModel.js"
import { Recipe } from "../models/menuModels/RecipeModel.js";
import { Menu } from "../models/menuModels/menuModel.js"
import { Ingredient } from "../models/menuModels/ingredientModel.js";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import slugify from "slugify";
import cloudinary from "../config/cloudinary.js"
import fs from 'fs';

import { clearCache } from "../utils/redis.utils.js";
import { emitOrderUpdated } from "../utils/orderRealtime.js";
import { createDeliveryOtp } from "../utils/deliveryVerification.js";
import { sendInternalNotification } from "./notificationController.js";

const clearCategoryCaches = (type) => {
  const patternsByType = {
    product: ["categories:product:*", "products:*"],
    menu: ["categories:menu:*", "menus:list:*"],
    recipe: ["categories:recipe:*", "recipes:list:*"],
  };

  return clearCache(patternsByType[type] || []);
};

const distanceInKm = (left, right) => {
  if (
    !Number.isFinite(left?.latitude) ||
    !Number.isFinite(left?.longitude) ||
    !Number.isFinite(right?.latitude) ||
    !Number.isFinite(right?.longitude)
  ) return null;
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export const registerUser = async (req, res) => {
  try {
    const { name, username, email, password, phone, role } = req.body;

    const actorRole = req.user.role;
    const validRoles = actorRole === "super_admin"
      ? ["admin", "shipper", "super_admin"]
      : ["shipper"];

    if (!validRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền tạo tài khoản với vai trò này"
      });
    }

    if (role === "super_admin" && actorRole !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Chỉ Super Admin mới có thể tạo Super Admin"
      });
    }

    if (role === "super_admin") {
      const existingSuperAdmin = await User.findOne({ role: "super_admin" });
      if (existingSuperAdmin) {
        return res.status(400).json({
          success: false,
          message: "Super admin đã tồn tại"
        });
      }
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập hoặc email đã tồn tại"
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = new User({
      name,
      username,
      email,
      password: hashedPassword,
      phone,
      role,
      isVerified: role !== "admin" ? false : true,
      isActive: true
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: `Tạo tài khoản ${role} thành công`,
      data: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, email, password, role } = req.body;
        const actorRole = req.user.role;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
        }

        if (actorRole === "admin" && user.role !== "shipper") {
            return res.status(403).json({ success: false, message: "Admin chỉ được chỉnh sửa tài khoản Shipper" });
        }

        if (actorRole === "admin" && role && role !== "shipper") {
            return res.status(403).json({ success: false, message: "Admin không được thay đổi vai trò này" });
        }

        if (actorRole === "admin" && role === "shipper") {
            // only allow shipper updates
        }

        if (actorRole === "super_admin" && role === "super_admin" && user.role !== "super_admin") {
          const existingSuperAdmin = await User.findOne({ role: "super_admin" });
          if (existingSuperAdmin && existingSuperAdmin._id.toString() !== user._id.toString()) {
            return res.status(400).json({ success: false, message: "Super admin đã tồn tại" });
          }
        }

        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "Tên đăng nhập đã tồn tại" });
            }
        }

        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ success: false, message: "Email đã tồn tại" });
            }
        }

        if (password) {
            user.password = await bcryptjs.hash(password, 10);
        }

        user.name = name || user.name;
        user.username = username || user.username;
        user.email = email || user.email;
        user.role = role || user.role;

        await user.save();

        res.status(200).json({
            success: true,
            message: "Cập nhật thành công",
            data: {
                _id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const skip = (page - 1) * limit;

        const filter = status && status !== 'all' ? { status } : {};

        const orders = await Order.find(filter)
            .populate('userId', 'name')
            .populate('address', 'name phone address')
            .populate('shipperId', 'name phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const orderItems = await OrderItem.find({
            orderId: { $in: orders.map((order) => order._id) },
        }).lean();
        const itemsByOrder = orderItems.reduce((grouped, item) => {
            const key = item.orderId.toString();
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
            return grouped;
        }, {});

        const ordersData = orders.map(order => {
            const orderObj = order.toObject();
            return {
                ...orderObj,
                items: itemsByOrder[order._id.toString()] || [],
                address: orderObj.deliveryAddress?.address
                    ? orderObj.deliveryAddress
                    : orderObj.address,
                shipperInfo: orderObj.shipperId ? {
                    _id: orderObj.shipperId._id,
                    name: orderObj.shipperId.name,
                    phone: orderObj.shipperId.phone
                } : null,
            };
        });

        const totalOrders = await Order.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: ordersData,
            meta: {
                total: totalOrders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAdminAndShippers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { role, search, availability, orderId } = req.query;

        let query;
        if (req.user.role === "admin") {
            query = { role: "shipper"};
        } else {
            query = { role: { $in: ["admin", "shipper"] }};
        }

        if (role && role !== "all") {
            if (req.user.role === "super_admin") {
                query.role = role;
            } else if (role === "shipper") {
                query.role = "shipper";
            }
        }

        if (role === "shipper" && availability === "online") {
            query.isOnline = true;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const users = await User.find(query)
            .select("-password")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        let assignmentLocation = null;
        if (role === "shipper" && orderId) {
            const order = await Order.findById(orderId).select("deliveryAddress").lean();
            assignmentLocation = order?.deliveryAddress;
        }
        const activeCountMap = new Map();
        const maxActiveOrders = Math.max(Number(process.env.SHIPPER_MAX_ACTIVE_ORDERS) || 5, 1);
        if (role === "shipper") {
            const counts = await Order.aggregate([
                {
                    $match: {
                        shipperId: { $in: users.map((user) => user._id) },
                        status: { $in: ["assigned", "confirmed", "processing", "shipping", "pending_cancel"] },
                    },
                },
                { $group: { _id: "$shipperId", count: { $sum: 1 } } },
            ]);
            counts.forEach((item) => activeCountMap.set(item._id.toString(), item.count));
        }
        let userData = users
          .map((user) => {
            const value = user.toObject();
            const distance = distanceInKm(assignmentLocation, value.lastKnownLocation);
            const activeOrderCount = activeCountMap.get(user._id.toString()) || 0;
            return {
                ...value,
                distanceKm: distance === null ? null : Number(distance.toFixed(1)),
                activeOrderCount,
                maxActiveOrders,
            };
          })
          .sort((left, right) => (left.distanceKm ?? Number.MAX_VALUE) - (right.distanceKm ?? Number.MAX_VALUE));
        if (role === "shipper" && availability === "online") {
            userData = userData.filter((user) => user.activeOrderCount < maxActiveOrders);
        }

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: userData,
            meta: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User không tồn tại" });
        }

        if (req.user.role === "admin" && user.role !== "shipper") {
            return res.status(403).json({ success: false, message: "Admin chỉ được vô hiệu hóa tài khoản Shipper" });
        }

        const activeOrders = await Order.exists({
            shipperId: id,
            status: { $nin: ['delivered', 'cancelled', 'returned'] }
        });

        if (activeOrders) {
            return res.status(400).json({ 
                success: false, 
                message: "Shipper này đang có đơn hàng chưa hoàn thành, không thể vô hiệu hóa." 
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id, 
            { isActive: false }, 
            { new: true }
        );
        
        res.status(200).json({ success: true, message: "Đã vô hiệu hóa tài khoản thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const activateUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User không tồn tại"
            });
        }

        if (req.user.role === "admin" && user.role !== "shipper") {
            return res.status(403).json({
                success: false,
                message: "Admin chỉ được kích hoạt tài khoản Shipper"
            });
        }

        if (user.isActive) {
            return res.status(400).json({
                success: false,
                message: "Tài khoản đang hoạt động"
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Đã kích hoạt tài khoản thành công",
            data: updatedUser
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const assignOrderToShipper = async (req, res) => {
    try {
        const { orderId, shipperId } = req.body;
        const maxActiveOrders = Math.max(Number(process.env.SHIPPER_MAX_ACTIVE_ORDERS) || 5, 1);
        const assignmentTimeoutMinutes = Math.max(Number(process.env.SHIPPER_ASSIGNMENT_TIMEOUT_MINUTES) || 10, 1);

        const shipper = await User.findOne({
            _id: shipperId,
            role: "shipper",
            isActive: true,
            isOnline: true
        });
        if (!shipper) {
            return res.status(409).json({
                success: false,
                code: "SHIPPER_UNAVAILABLE",
                message: "Shipper đang ngoại tuyến hoặc không còn sẵn sàng nhận đơn."
            });
        }

        const activeOrders = await Order.countDocuments({
            shipperId,
            status: { $in: ["assigned", "confirmed", "processing", "shipping", "pending_cancel"] },
        });
        if (activeOrders >= maxActiveOrders) {
            return res.status(409).json({
                success: false,
                code: "SHIPPER_CAPACITY_REACHED",
                message: `Shipper đã đạt giới hạn ${maxActiveOrders} đơn đang xử lý.`,
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Đơn hàng không tồn tại."
            });
        }

        if (order.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Không thể phân công đơn hàng đang ở trạng thái: ${order.status}`
            });
        }
        if (order.paymentMethod !== "cod" && order.paymentStatus !== "paid") {
            return res.status(409).json({
                success: false,
                code: "PAYMENT_NOT_CONFIRMED",
                message: "Đơn thanh toán online chưa được xác nhận nên chưa thể phân công giao hàng.",
            });
        }

        order.shipperId = shipperId;
        order.status = "assigned";
        const deliveryOtp = createDeliveryOtp();
        order.deliveryVerification = {
            otpHash: deliveryOtp.otpHash,
            otpExpiresAt: deliveryOtp.otpExpiresAt,
        };
        order.assignment = {
            ...order.assignment?.toObject?.(),
            assignedAt: new Date(),
            expiresAt: new Date(Date.now() + assignmentTimeoutMinutes * 60 * 1000),
        };
        order.$locals.statusActor = {
            actorId: req.user._id,
            actorRole: req.user.role,
            note: `Phân công cho shipper ${shipper.name}`,
        };
        
        await order.save();
        await sendInternalNotification(
            order.userId,
            "Mã xác nhận giao hàng",
            `Mã nhận hàng của đơn #${String(order._id).slice(-6).toUpperCase()} là ${deliveryOtp.code}. Chỉ cung cấp mã sau khi đã nhận đủ hàng.`,
            { orderId: order._id, type: "delivery_otp" },
            null,
            req.app.get("io"),
        );

       const io = req.app.get('io');
        if (io) {
            const targetRoom = shipperId.toString();
            const socketsInRoom = io.sockets.adapter.rooms.get(targetRoom);
            io.to(targetRoom).emit('new_order_assigned', {
                orderId: order._id,
                message: "Bạn có đơn hàng mới được phân công"
            });
            emitOrderUpdated(io, order, { assigned: true });
        } else {
            console.log("[DEBUG] IO instance not found");
        }
        order.deliveryVerification.otpHash = undefined;

        res.status(200).json({
            success: true,
            message: "Phân công đơn hàng thành công",
            data: order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi phân công đơn hàng",
            error: error.message
        });
    }
};

export const reassignOrderToShipper = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { shipperId, reason } = req.body;
        const maxActiveOrders = Math.max(Number(process.env.SHIPPER_MAX_ACTIVE_ORDERS) || 5, 1);
        const assignmentTimeoutMinutes = Math.max(Number(process.env.SHIPPER_ASSIGNMENT_TIMEOUT_MINUTES) || 10, 1);

        const [order, shipper] = await Promise.all([
            Order.findById(orderId),
            User.findOne({ _id: shipperId, role: "shipper", isActive: true, isOnline: true }),
        ]);
        if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        if (!shipper) {
            return res.status(409).json({
                success: false,
                code: "SHIPPER_UNAVAILABLE",
                message: "Shipper mới đang ngoại tuyến hoặc không sẵn sàng.",
            });
        }
        if (!["assigned", "confirmed", "pending_cancel"].includes(order.status)) {
            return res.status(409).json({
                success: false,
                message: "Chỉ có thể đổi shipper trước khi đơn bắt đầu giao.",
            });
        }
        if (order.shipperId?.equals(shipper._id)) {
            return res.status(400).json({ success: false, message: "Đơn hàng đã thuộc shipper này." });
        }
        const activeOrders = await Order.countDocuments({
            shipperId,
            status: { $in: ["assigned", "confirmed", "processing", "shipping", "pending_cancel"] },
        });
        if (activeOrders >= maxActiveOrders) {
            return res.status(409).json({
                success: false,
                code: "SHIPPER_CAPACITY_REACHED",
                message: "Shipper mới đã đạt giới hạn đơn đang xử lý.",
            });
        }

        const previousShipperId = order.shipperId;
        order.shipperId = shipper._id;
        order.status = "assigned";
        const deliveryOtp = createDeliveryOtp();
        order.deliveryVerification = {
            otpHash: deliveryOtp.otpHash,
            otpExpiresAt: deliveryOtp.otpExpiresAt,
        };
        order.cancelRequest = undefined;
        order.assignment = {
            assignedAt: new Date(),
            expiresAt: new Date(Date.now() + assignmentTimeoutMinutes * 60 * 1000),
            reassignedAt: new Date(),
            previousShipperId,
            reassignmentReason: reason,
        };
        order.$locals.statusActor = {
            actorId: req.user._id,
            actorRole: req.user.role,
            note: `Đổi shipper: ${reason}`,
        };
        await order.save();
        await sendInternalNotification(
            order.userId,
            "Mã xác nhận giao hàng mới",
            `Mã nhận hàng mới của đơn #${String(order._id).slice(-6).toUpperCase()} là ${deliveryOtp.code}.`,
            { orderId: order._id, type: "delivery_otp" },
            null,
            req.app.get("io"),
        );

        const io = req.app.get("io");
        if (previousShipperId) {
            io?.to(previousShipperId.toString()).emit("order_unassigned", { orderId: order._id });
        }
        io?.to(shipper._id.toString()).emit("new_order_assigned", {
            orderId: order._id,
            message: "Bạn có đơn hàng mới được phân công",
        });
        emitOrderUpdated(io, order, { reassigned: true });
        order.deliveryVerification.otpHash = undefined;
        return res.status(200).json({ success: true, message: "Đổi shipper thành công", data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const approveCancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { orderId, adminNote } = req.body;
        
        const order = await Order.findById(orderId).session(session);

        if (!order) {
            throw new Error("Không tìm thấy đơn hàng");
        }

        if (order.status === 'cancelled') {
            throw new Error("Đơn hàng đã được hủy trước đó");
        }

        order.status = 'cancelled';
        order.cancelledAt = new Date();
        order.cancelledBy = 'admin';
        
        order.cancelRequest = {
            ...order.cancelRequest,
            adminNote: adminNote || "Được phê duyệt bởi Admin",
            isAccepted: true,
            requestedAt: order.cancelRequest?.requestedAt || new Date()
        };

        const orderItems = await OrderItem.find({ orderId: order._id }).session(session);

        for (const item of orderItems) {
            await Product.findByIdAndUpdate(
                item.productId,
                { $inc: { stock: item.quantity } },
                { session }
            );
        }

        if (order.paymentStatus === 'paid') {
            order.paymentStatus = 'refunded';
        }

        await order.save({ session });
        await session.commitTransaction();
        emitOrderUpdated(req.app.get("io"), order);

        res.status(200).json({
            success: true,
            message: "Đã phê duyệt hủy đơn thành công"
        });

    } catch (err) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: err.message
        });
    } finally {
        session.endSession();
    }
};

export const processCancelOrder = async (req, res) => {
  try {
    const { orderId, action, adminNote } = req.body;
    const order = await Order.findById(orderId);

    if (!order || order.status !== "pending_cancel") {
      return res.status(400).json({ success: false, message: "Trạng thái đơn hàng không hợp lệ" });
    }

    if (action === "accept") {
      order.status = "cancelled";
      order.cancelRequest.isAccepted = true;
      order.cancelledBy = "admin"
    } else {
      order.status = "assigned";
      order.cancelRequest.isAccepted = false;
    }

    order.cancelRequest.adminNote = adminNote;
    await order.save();

    const io = req.app.get("io");
    io.to(order.shipperId.toString()).emit("shipper_cancel_result", {
      orderId: order._id,
      status: order.status,
      message: action === "accept" ? "Yêu cầu hủy đơn đã được chấp nhận" : "Yêu cầu hủy đơn bị từ chối",
    });

    emitOrderUpdated(io, order);
    io.to("admins").emit("admin_refresh_orders", { orderId: order._id });

    res.status(200).json({ success: true, status: order.status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const skip = (page - 1) * limit;
    const { search } = req.query

    let filter = { isSpecialty: false };

    if (status === 'in_stock') {
      filter.stock = { $gt: 0 };
    } else if (status === 'out_of_stock') {
      filter.stock = { $lte: 0 };
    }

    if(search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } }
      ]
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('categoryId', '_id name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSpecials = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    let filter = {  };

    if (status === 'in_stock') {
      filter.stock = { $gt: 0 };
    } else if (status === 'out_of_stock') {
      filter.stock = { $lte: 0 };
    }

    const total = await Special.countDocuments(filter);
    const products = await Special.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type;
    const skip = (page - 1) * limit;

    let Model;

    switch (type) {
      case 'product':
        Model = Category;
        break;
      case 'menu':
        Model = CategoryMenu;
        break;
      case 'recipe':
        Model = CategoryRecipe;
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid category type" });
    }

    const total = await Model.countDocuments();
    const data = await Model.find() 
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, title, description, type } = req.body;

    if (!type || !['product', 'menu', 'recipe'].includes(type)) {
      return res.status(400).json({ message: "Invalid or missing category type" });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const slug = slugify(name, { lower: true, strict: true });
    let Model;
    let createData = { name, slug };

    switch (type) {
      case 'product':
        Model = Category;
        let imageUrl = null;
        if (req.file) {
          const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            folder: "categories",
          });
          imageUrl = uploadResult.secure_url;
        }
        createData.image = imageUrl;
        break;

      case 'menu':
        Model = CategoryMenu;
        if (!title || !title.trim() || !description || !description.trim()) {
          return res.status(400).json({ message: "Title and Description are required for Menu" });
        }
        createData.title = title;
        createData.description = description;
        break;

      case 'recipe':
        Model = CategoryRecipe;
        if (!description || !description.trim()) {
          return res.status(400).json({ message: "Description is required for Recipe" });
        }
        createData.description = description;
        break;
    }

    const existedCategory = await Model.findOne({ slug });
    if (existedCategory) {
      return res.status(400).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} Category already exists` });
    }

    const newCategory = await Model.create(createData);
    if (newCategory) {
        const deletedCount = await clearCategoryCaches(type);
        console.log(`Redis: Cleared ${deletedCount} cache keys for category type ${type}`);
    }
    return res.status(201).json({
      success: true,
      code: 201,
      data: newCategory,
    });
  } catch (error) {
    console.error("Create category error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, title, description, type } = req.body;

    if (!type || !['product', 'menu', 'recipe'].includes(type)) {
      return res.status(400).json({ message: "Invalid category type" });
    }

    let Model;
    switch (type) {
      case 'product': Model = Category; break;
      case 'menu': Model = CategoryMenu; break;
      case 'recipe': Model = CategoryRecipe; break;
    }

    const category = await Model.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    let updateData = {};
    
    if (name) {
      updateData.name = name;
      updateData.slug = slugify(name, { lower: true, strict: true });
    }

    if (type === 'product') {
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "categories",
        });
        updateData.image = uploadResult.secure_url;
      }
    } else if (type === 'menu') {
      if (title) updateData.title = title;
      if (description) updateData.description = description;
    } else if (type === 'recipe') {
      if (description) updateData.description = description;
    }

    const updatedCategory = await Model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    const deletedCount = await clearCategoryCaches(type);
    console.log(`Redis: Cleared ${deletedCount} cache keys for category type ${type}`);

    return res.status(200).json({
      success: true,
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Update category error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;

        let Model;

        switch (type) {
            case "product":
                Model = Category;
                break;
            case "menu":
                Model = CategoryMenu;
                break;
            case "recipe":
                Model = CategoryRecipe;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Loại danh mục không hợp lệ"
                });
        }

        const category = await Model.findById(id);

        if (!category || category.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục hoặc danh mục đã bị vô hiệu hóa"
            });
        }

        const updatedCategory = await Model.findByIdAndUpdate(
            id,
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            },
            { new: true }
        );

        const deletedCount = await clearCategoryCaches(type);

        console.log(
            `Redis: Đã xóa ${deletedCount} cache cho danh mục loại ${type}`
        );

        return res.status(200).json({
            success: true,
            message: "Đã chuyển danh mục vào trạng thái vô hiệu hóa",
            data: updatedCategory
        });
    } catch (error) {
        console.error("Delete Category Error:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi server khi vô hiệu hóa danh mục"
        });
    }
};

export const restoreCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;
        let Model;

        switch (type) {
            case "product":
                Model = Category;
                break;
            case "menu":
                Model = CategoryMenu;
                break;
            case "recipe":
                Model = CategoryRecipe;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Loại danh mục không hợp lệ"
                });
        }

        const category = await Model.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy danh mục"
            });
        }

        if (!category.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Danh mục đang ở trạng thái hoạt động"
            });
        }

        const restoredCategory = await Model.findByIdAndUpdate(
            id,
            {
                $set: {
                    isDeleted: false,
                    deletedAt: null
                }
            },
            { new: true }
        );

        const restoredCount = await clearCategoryCaches(type);

        console.log(
            `Redis: Đã xóa ${restoredCount} cache cho danh mục loại ${type}`
        );

        return res.status(200).json({
            success: true,
            message: "Đã kích hoạt lại danh mục thành công",
            data: restoredCategory
        });
    } catch (error) {
        console.error("Restore Category Error:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi server khi kích hoạt lại danh mục"
        });
    }
};

export const createProduct = async (req, res) => {
  try {
    const data = req.body;

    const parseField = (field) => {
      if (!field) return undefined;
      try {
        return typeof field === "string" ? JSON.parse(field) : field;
      } catch {
        return field;
      }
    };

    const usage_instruction = parseField(data.usage_instruction);
    const season = parseField(data.season);
    const nutrition = parseField(data.nutrition);

    const {
      name, categoryId, price, unit, description, stock,
      region, origin, originDescription, originFound, story,
      salePercent, isSpecialty, isActive = true
    } = data;

    const requiredFields = [name, price, unit, description, stock, region];
    
    const isSpec = String(isSpecialty) === "true";
    if (isSpec) {
      requiredFields.push(origin, originDescription, originFound, story);
    }

    if (requiredFields.some(field => !field || String(field).trim() === "")) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const slug = slugify(name, { lower: true, strict: true });
    const existedProduct = await Product.findOne({ slug });
    if (existedProduct) {
      return res.status(400).json({ message: "Product already exists" });
    }

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: "products",
    });

    const productData = {
      name,
      slug,
      categoryId: categoryId?.trim() ? categoryId : null,
      price: Number(price),
      unit,
      description,
      images: uploadResult.secure_url,
      stock: Number(stock),
      region,
      isSpecialty: isSpec,
      isActive: String(isActive) === "true",
      salePercent: salePercent?.trim() ? salePercent : null,
      
      nutrition: {
        calories: Number(nutrition?.calories) || 0,
        protein: Number(nutrition?.protein) || 0,
        fat: Number(nutrition?.fat) || 0,
        carbs: Number(nutrition?.carbs) || 0,
      },
      usage_instruction: Array.isArray(usage_instruction) ? usage_instruction : [],
      season: Array.isArray(season) ? season : [],
      
      origin: origin || null,
      originDescription: originDescription || null,
      originFound: originFound || null,
      story: story || null,
    };
    
    const newProduct = await Product.create(productData);
    await clearCache("products:*");

    return res.status(201).json({
      code: 201,
      message: "Product created successfully",
      data: newProduct,
    });

  } catch (error) {
    console.error("Create product error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

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

export const createSale = async (req, res) => {
    try {
        const { percent, startDate, endDate } = req.body;

        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Ngày kết thúc phải sau ngày bắt đầu"
            });
        }

        const newSale = await SaleItem.create({
            percent,
            startDate,
            endDate
        });

        return res.status(201).json({
            success: true,
            message: "Tạo chương trình giảm giá thành công",
            data: newSale
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSale = async (req, res) => {
    try {
        const { id } = req.params;
        const { percent, startDate, endDate, isActive } = req.body;

        if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Ngày kết thúc phải sau ngày bắt đầu"
            });
        }

        const updatedSale = await SaleItem.findByIdAndUpdate(
            id,
            { percent, startDate, endDate, isActive },
            { new: true, runValidators: true }
        );

        if (!updatedSale) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy chương trình giảm giá"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật thành công",
            data: updatedSale
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSale = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedSale = await SaleItem.findByIdAndDelete(id);

        if (!deletedSale) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy chương trình để xóa"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Đã xóa chương trình giảm giá vĩnh viễn"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateProductAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const currentProduct = await Product.findById(id);

    if (!currentProduct) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    if (req.body.nutrition) {
      updateData.nutrition = JSON.parse(req.body.nutrition);
    }
    if (req.body.usage_instruction) {
      updateData.usage_instruction = JSON.parse(req.body.usage_instruction);
    }
    if (req.body.season) {
      updateData.season = JSON.parse(req.body.season);
    }

    if (req.body.name) {
      updateData.slug = slugify(req.body.name, { lower: true, strict: true });
    }

    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "products",
      });
      updateData.images = uploadResult.secure_url;
    }

    // Product schema uses `images`; never persist the obsolete singular field.
    delete updateData.image;

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    await clearCache("products:*");

    return res.status(200).json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      data: updatedProduct
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi cập nhật" });
  }
};

export const getProductDetailAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate("categoryId", "name")
            .populate("salePercent", "name percent");

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm"
            });
        }

        return res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error("Get Product Detail Error:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy chi tiết sản phẩm"
        });
    }
};

export const getSpecialDetailAdmin = async (req, res) => {
  try {
    const special = await Special.findById(req.params.id)
      .populate("salePercent", "name percent startDate endDate");

    if (!special) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đặc sản" });
    }

    return res.status(200).json({ success: true, data: special });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSpecialAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const special = await Special.findById(id);

    if (!special) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đặc sản" });
    }

    for (const field of ["nutrition", "usage_instruction"]) {
      if (req.body[field]) updateData[field] = JSON.parse(req.body[field]);
    }
    if (req.body.name) {
      updateData.slug = slugify(req.body.name, { lower: true, strict: true });
    }
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "specials",
      });
      updateData.images = uploadResult.secure_url;
    }

    delete updateData.image;
    delete updateData.isSpecialty;
    delete updateData.season;

    const updatedSpecial = await Special.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    await clearCache("products:special_model:*");
    return res.status(200).json({
      success: true,
      message: "Cập nhật đặc sản thành công",
      data: updatedSpecial,
    });
  } catch (error) {
    console.error("Update Special Error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi cập nhật đặc sản" });
  }
};

export const deleteSpecialAdmin = async (req, res) => {
  try {
    const special = await Special.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!special) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đặc sản" });
    }

    await clearCache("products:special_model:*");
    return res.status(200).json({
      success: true,
      message: "Đã ngừng kinh doanh đặc sản",
      data: special,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const activateSpecialAdmin = async (req, res) => {
    try {
        const special = await Special.findByIdAndUpdate(
            req.params.id,
            { isActive: true },
            { new: true },
        );

        if (!special) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đặc sản"
            });
        }

        await clearCache("products:special_model:*");

        return res.status(200).json({
            success: true,
            message: "Đã kích hoạt lại đặc sản",
            data: special,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const deleteProductAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedProduct = await Product.findByIdAndUpdate(
            id,
            { isActive: false }, 
            { new: true }
        );

        if (!deletedProduct) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm"
            });
        }

        await clearCache("products:*");

        return res.status(200).json({
            success: true,
            message: "Đã chuyển sản phẩm vào trạng thái ngưng hoạt động",
            data: deletedProduct
        });
    } catch (error) {
        console.error("Delete Product Error:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi xóa sản phẩm"
        });
    }
};

export const activateProductAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const activatedProduct = await Product.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );

        if (!activatedProduct) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm"
            });
        }

        await clearCache("products:*");

        return res.status(200).json({
            success: true,
            message: "Đã kích hoạt lại sản phẩm thành công",
            data: activatedProduct
        });
    } catch (error) {
        console.error("Activate Product Error:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi kích hoạt lại sản phẩm"
        });
    }
};

export const getAllRecipesAdmin = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search, 
            difficulty, 
            weatherTag, 
            category 
        } = req.query;

        const query = { };

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        if (difficulty) {
            query.difficulty = difficulty;
        }

        if (weatherTag) {
            query.weatherTag = weatherTag;
        }

        if (category) {
            query.category = category;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const recipes = await Recipe.find(query)
            .populate("category", "name") 
            .select("name image difficulty cookTime weatherTag createdAt slug isDeleted") 
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Recipe.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: recipes,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get All Recipes Error:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách công thức",
            error: error.message
        });
    }
};

export const getAllIngredientsAdmin = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;

        const query = {};

        if (search) {
            query.customName = { $regex: search, $options: "i" };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const ingredients = await Ingredient.find(query)
            .populate("creatorId", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Ingredient.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: ingredients,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error("Get All Ingredients Error:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách nguyên liệu",
            error: error.message
        });
    }
};

export const createIngredient = async (req, res) => {
    try {
        const { customName, price, unit } = req.body;
        const slug = slugify(customName, { lower: true });

        const newIngredient = await Ingredient.create({
            customName,
            slug,
            price,
            unit,
            creatorId: null
        });

        res.status(201).json({ success: true, data: newIngredient });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateIngredient = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        
        if (updateData.customName) {
            updateData.slug = slugify(updateData.customName, { lower: true });
        }

        const updated = await Ingredient.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteIngredient = async (req, res) => {
    try {
        await Ingredient.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Xóa thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createRecipeAdmin = async (req, res) => {
    try {
        const { 
            name, 
            description,
            ingredients, 
            instructions,
            additionalIngredients,
            tips,
            suggestedSideDishes,
            weatherTag,
            meta, 
            difficulty, 
            instructionUrl, 
            cookTime,
            category 
        } = req.body;

        if (!name || !description) {
            return res.status(400).json({ message: "Name and Description are required" });
        }

        const parseJson = (data) => {
            if (!data) return undefined;
            if (typeof data === 'string') return JSON.parse(data);
            return data;
        };

        let parsedIngredients, parsedInstructions, parsedMeta, parsedTips, parsedAdditional, parsedSideDishes;
        
        try {
            parsedIngredients = parseJson(ingredients);
            parsedInstructions = parseJson(instructions);
            parsedMeta = parseJson(meta);
            parsedTips = parseJson(tips);
            parsedAdditional = parseJson(additionalIngredients);
            parsedSideDishes = parseJson(suggestedSideDishes);
        } catch (e) {
            return res.status(400).json({ message: "Invalid JSON format in nested fields" });
        }

        if (!parsedIngredients || !Array.isArray(parsedIngredients) || parsedIngredients.length === 0) {
            return res.status(400).json({ message: "Ingredients list cannot be empty" });
        }

        let imageUrl = "";
        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: "Recipe",
            });
            imageUrl = uploadResult.secure_url;
        }

        const slug = slugify(name, { lower: true, strict: true });

        const existedRecipe = await Recipe.findOne({ slug });
        if (existedRecipe) {
            return res.status(400).json({ message: "Recipe slug already exists" });
        }

        const newRecipe = new Recipe({
            name,
            slug,
            description,
            image: imageUrl,
            category,
            ingredients: parsedIngredients, 
            additionalIngredients: parsedAdditional,
            instructions: parsedInstructions,
            weatherTag: weatherTag || "neutral",
            tips: parsedTips,
            suggestedSideDishes: parsedSideDishes,
            meta: {
                servings: parsedMeta?.servings || "2-3",
                cookType: parsedMeta?.cookType || "Tự nấu tại nhà",
                isPrepped: parsedMeta?.isPrepped || false
            },
            difficulty: difficulty || "Dễ",
            instructionUrl,
            cookTime: Number(cookTime) || 0,
            isSystem: true
        });

        await newRecipe.save();

        return res.status(201).json({
            success: true,
            message: "Recipe created successfully",
            data: newRecipe,
        });

    } catch (error) {
        console.error("Create recipe error:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const updateRecipeAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, description, ingredients, instructions, 
            additionalIngredients, tips, suggestedSideDishes, 
            weatherTag, meta, difficulty, instructionUrl, 
            cookTime, category 
        } = req.body;

        const recipe = await Recipe.findById(id);
        if (!recipe) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        const parseJson = (data) => {
            if (!data) return undefined;
            if (typeof data === 'string') return JSON.parse(data);
            return data;
        };

        let parsedIngredients, parsedInstructions, parsedMeta, parsedTips, parsedAdditional, parsedSideDishes;
        try {
            parsedIngredients = parseJson(ingredients);
            parsedInstructions = parseJson(instructions);
            parsedMeta = parseJson(meta);
            parsedTips = parseJson(tips);
            parsedAdditional = parseJson(additionalIngredients);
            parsedSideDishes = parseJson(suggestedSideDishes);
        } catch (e) {
            return res.status(400).json({ message: "Invalid JSON format in nested fields" });
        }

        let imageUrl = recipe.image;
        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: "Recipe",
            });
            imageUrl = uploadResult.secure_url;
        }

        if (name && name !== recipe.name) {
            const newSlug = slugify(name, { lower: true, strict: true });
            const existed = await Recipe.findOne({ slug: newSlug, _id: { $ne: id } });
            if (existed) return res.status(400).json({ message: "New name results in an existing slug" });
            recipe.slug = newSlug;
            recipe.name = name;
        }

        recipe.description = description || recipe.description;
        recipe.image = imageUrl;
        recipe.category = category || recipe.category;
        recipe.ingredients = parsedIngredients || recipe.ingredients;
        recipe.instructions = parsedInstructions || recipe.instructions;
        recipe.additionalIngredients = parsedAdditional || recipe.additionalIngredients;
        recipe.tips = parsedTips || recipe.tips;
        recipe.suggestedSideDishes = parsedSideDishes || recipe.suggestedSideDishes;
        recipe.weatherTag = weatherTag || recipe.weatherTag;
        recipe.difficulty = difficulty || recipe.difficulty;
        recipe.instructionUrl = instructionUrl || recipe.instructionUrl;
        recipe.cookTime = cookTime !== undefined ? Number(cookTime) : recipe.cookTime;

        if (parsedMeta) {
            recipe.meta = {
                servings: parsedMeta.servings || recipe.meta.servings,
                cookType: parsedMeta.cookType || recipe.meta.cookType,
                isPrepped: parsedMeta.isPrepped !== undefined ? parsedMeta.isPrepped : recipe.meta.isPrepped
            };
        }

        await recipe.save();
        await clearCache("recipes:list:*");

        return res.status(200).json({
            success: true,
            message: "Recipe updated successfully",
            data: recipe,
        });

    } catch (error) {
        console.error("Update recipe error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteRecipeAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const recipe = await Recipe.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true }
        );

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy công thức"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Đã chuyển công thức vào thùng rác",
            data: recipe
        });
    } catch (error) {
        console.error("Lỗi khi xóa công thức:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa công thức"
        });
    }
};


export const restoreRecipeAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const recipe = await Recipe.findById(id);

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy công thức"
            });
        }

        if (!recipe.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Công thức đang ở trạng thái hoạt động"
            });
        }

        const restoredRecipe = await Recipe.findByIdAndUpdate(
            id,
            { isDeleted: false },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Đã khôi phục công thức thành công",
            data: restoredRecipe
        });
    } catch (error) {
        console.error("Lỗi khi khôi phục công thức:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi khôi phục công thức"
        });
    }
};

export const getRecipeByIdAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const recipe = await Recipe.findOne({ _id: id, isDeleted: false })
            .populate('category', 'name')
            .populate('ingredients.ingredientId');

        if (!recipe) {
            return res.status(404).json({ message: "Recipe not found" });
        }

        return res.status(200).json({
            success: true,
            data: recipe
        });
    } catch (error) {
        console.error("Get recipe detail error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllMenus = async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    const query = { };

    if (category && category !== 'undefined' && category !== 'null' && category !== '') {
      query.category = category;
    }

    const menus = await Menu.find(query)
      .populate('category', 'name')
      .populate('recipes', 'title image')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Menu.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: menus,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("Get all menus error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createMenu = async (req, res) => {
    const tempFilePath = req.file?.path;

    try {
        const { 
            title, 
            titleBanner, 
            description, 
            category, 
            meta, 
            recipes, 
            cookTime 
        } = req.body;

        if (!title || !titleBanner) {
            if (tempFilePath) fs.unlinkSync(tempFilePath);
            return res.status(400).json({ message: "Title and TitleBanner are required" });
        }

        const parseJson = (data) => {
            if (!data) return undefined;
            if (typeof data === 'string') return JSON.parse(data);
            return data;
        };

        let parsedRecipes, parsedMeta;
        try {
            parsedRecipes = parseJson(recipes);
            parsedMeta = parseJson(meta);
        } catch (e) {
            if (tempFilePath) fs.unlinkSync(tempFilePath);
            return res.status(400).json({ message: "Invalid JSON format in recipes or meta" });
        }

        if (!parsedRecipes || !Array.isArray(parsedRecipes) || parsedRecipes.length === 0) {
            if (tempFilePath) fs.unlinkSync(tempFilePath);
            return res.status(400).json({ message: "Recipes list cannot be empty" });
        }

        const slug = slugify(title, { lower: true, strict: true });
        const existedMenu = await Menu.findOne({ slug, isDeleted: false });
        if (existedMenu) {
            if (tempFilePath) fs.unlinkSync(tempFilePath);
            return res.status(400).json({ message: "Menu title already exists" });
        }

        let imageUrl = "";
        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
                folder: "Menus",
            });
            imageUrl = uploadResult.secure_url;
            fs.unlinkSync(tempFilePath); // Xóa file ngay sau khi upload thành công
        }

        const recipeDetails = await Recipe.find({ _id: { $in: parsedRecipes } }).populate("ingredients");
        if (recipeDetails.length !== parsedRecipes.length) {
            return res.status(400).json({ message: "One or more recipe IDs are invalid" });
        }

        const calculatedTotalPrice = recipeDetails.reduce((total, recipe) => {
            const recipePrice = recipe.ingredients?.reduce((sum, ing) => sum + (ing.price || 0), 0) || 0;
            return total + recipePrice;
        }, 0);

        const newMenu = new Menu({
            title,
            titleBanner,
            slug,
            description,
            image: imageUrl,
            category,
            meta: {
                servings: parsedMeta?.servings || "2-3",
                cookType: parsedMeta?.cookType || "Tự nấu tại nhà",
                isPrepped: parsedMeta?.isPrepped || false
            },
            recipes: parsedRecipes,
            cookTime: Number(cookTime) || 0,
            totalPrice: calculatedTotalPrice
        });

        await newMenu.save();

        return res.status(201).json({
            success: true,
            message: "Menu created successfully",
            data: newMenu,
        });

    } catch (error) {
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        console.error("Create menu error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const updateMenu = async (req, res) => {
    const { id } = req.params;
    const tempFilePath = req.file?.path;

    try {
        const { 
            title, 
            titleBanner, 
            description, 
            category, 
            meta, 
            recipes, 
            cookTime 
        } = req.body;

        const menu = await Menu.findById(id);
        if (!menu || menu.isDeleted) {
            if (tempFilePath) fs.unlinkSync(tempFilePath);
            return res.status(404).json({ message: "Menu không tồn tại" });
        }

        const parseJson = (data) => {
            if (!data) return undefined;
            if (typeof data === 'string') return JSON.parse(data);
            return data;
        };

        const parsedRecipes = parseJson(recipes);
        const parsedMeta = parseJson(meta);

        let updateData = {
            title: title || menu.title,
            titleBanner: titleBanner || menu.titleBanner,
            description: description || menu.description,
            category: category || menu.category,
            cookTime: cookTime ? Number(cookTime) : menu.cookTime,
            meta: {
                servings: parsedMeta?.servings || menu.meta.servings,
                cookType: parsedMeta?.cookType || menu.meta.cookType,
                isPrepped: parsedMeta?.isPrepped !== undefined ? parsedMeta.isPrepped : menu.meta.isPrepped
            }
        };

        if (title && title !== menu.title) {
            updateData.slug = slugify(title, { lower: true, strict: true });
        }

        if (parsedRecipes) {
            const recipeDetails = await Recipe.find({ _id: { $in: parsedRecipes } }).populate("ingredients");
            const calculatedTotalPrice = recipeDetails.reduce((total, recipe) => {
                const recipePrice = recipe.ingredients?.reduce((sum, ing) => sum + (ing.price || 0), 0) || 0;
                return total + recipePrice;
            }, 0);
            
            updateData.recipes = parsedRecipes;
            updateData.totalPrice = calculatedTotalPrice;
        }

        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
                folder: "Menus",
            });
            updateData.image = uploadResult.secure_url;
            fs.unlinkSync(tempFilePath);
            
            if (menu.image) {
                const publicId = menu.image.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`Menus/${publicId}`).catch(err => console.log("Cloudinary delete error:", err));
            }
        }

        const updatedMenu = await Menu.findByIdAndUpdate(id, updateData, { new: true });
        await clearCache("menus:list:*");

        return res.status(200).json({
            success: true,
            message: "Cập nhật Menu thành công",
            data: updatedMenu
        });

    } catch (error) {
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        console.error("Update menu error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteMenu = async (req, res) => {
    try {
        const { id } = req.params;

        const menu = await Menu.findById(id);
        if (!menu) {
            return res.status(404).json({ message: "Menu không tồn tại" });
        }

        if (menu.isDeleted) {
            return res.status(400).json({ message: "Menu này đã được xóa trước đó" });
        }

        menu.isDeleted = true;
        await menu.save();

        return res.status(200).json({
            success: true,
            message: "Xóa menu thành công"
        });
    } catch (error) {
        console.error("Delete menu error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const activeMenu = async (req, res) => {
    try {
        const { id } = req.params;

        const menu = await Menu.findById(id);

        if (!menu) {
            return res.status(404).json({
                success: false,
                message: "Menu không tồn tại"
            });
        }

        if (!menu.isDeleted) {
            return res.status(400).json({
                success: false,
                message: "Menu đang ở trạng thái hoạt động"
            });
        }

        menu.isDeleted = false;
        await menu.save();

        return res.status(200).json({
            success: true,
            message: "Kích hoạt lại menu thành công",
            data: menu
        });

    } catch (error) {
        console.error("Active menu error:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi server khi kích hoạt lại menu"
        });
    }
};

export const getMenuById = async (req, res) => {
    try {
        const { id } = req.params;

        const menu = await Menu.findOne({ _id: id, isDeleted: false })
            .populate('category', 'name')
            .populate({
                path: 'recipes',
                select: 'name image ingredients cookTime difficulty',
                populate: {
                    path: 'ingredients',
                    select: 'name price unit'
                }
            });

        if (!menu) {
            return res.status(404).json({ message: "Không tìm thấy thực đơn" });
        }

        return res.status(200).json({
            success: true,
            data: menu
        });
    } catch (error) {
        console.error("Get menu detail error:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "ID thực đơn không hợp lệ" });
        }
        return res.status(500).json({ error: "Lỗi hệ thống" });
    }
};
