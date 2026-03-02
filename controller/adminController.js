import { Order } from "../models/ordersModel.js"; 
import { User } from "../models/userModel.js"; 
import { OrderItem } from "../models/orderItemsModel.js"
import { Product } from "../models/productsModel.js"
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";

export const registerUser = async (req, res) => {
  try {
    const { name, username, email, password, phone, role } = req.body;

    const validRoles = ["admin", "shipper", "super_admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Vai trò không hợp lệ"
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

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
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

        const ordersData = orders.map(order => {
            const orderObj = order.toObject();
            return {
                ...orderObj,
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
        const { role, search } = req.query;

        let query = { role: { $in: ["admin", "shipper"] }, isActive: true };

        if (role && role !== "all") {
            query.role = role;
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

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users,
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

        const user = await User.findByIdAndUpdate(
            id, 
            { isActive: false }, 
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User không tồn tại" });
        }
        
        res.status(200).json({ success: true, message: "Đã vô hiệu hóa tài khoản thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const assignOrderToShipper = async (req, res) => {
    try {
        const { orderId, shipperId } = req.body;

        const shipper = await User.findOne({ _id: shipperId, role: "shipper", isActive: true });
        if (!shipper) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy shipper hoặc người dùng không có quyền giao hàng."
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

        order.shipperId = shipperId;
        order.status = "assigned";
        
        await order.save();

       const io = req.app.get('io');
        if (io) {
            const targetRoom = shipperId.toString();
            const socketsInRoom = io.sockets.adapter.rooms.get(targetRoom);
            io.to(targetRoom).emit('new_order_assigned', {
                orderId: order._id,
                message: "Bạn có đơn hàng mới được phân công"
            });
        } else {
            console.log("[DEBUG] IO instance not found");
        }

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

    req.app.get("io").to(order.shipperId.toString()).emit("shipper_cancel_result", {
      orderId: order._id,
      status: order.status,
      message: action === "accept" ? "Yêu cầu hủy đơn đã được chấp nhận" : "Yêu cầu hủy đơn bị từ chối",
    });

    req.app.get("io").emit("admin_refresh_orders", { orderId: order._id });

    res.status(200).json({ success: true, status: order.status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};