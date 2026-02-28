import { Order } from "../models/ordersModel.js"; 
import { User } from "../models/userModel.js"; 
import { OrderItem } from "../models/orderItemsModel.js"
import { Product } from "../models/productsModel.js"
import mongoose from "mongoose";
export const assignOrderToShipper = async (req, res) => {
    try {
        const { orderId, shipperId } = req.body;

        const shipper = await User.findOne({ _id: shipperId, role: "shipper" });
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

        if (order.status !== "pending" && order.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: `Không thể phân công đơn hàng đang ở trạng thái: ${order.status}`
            });
        }

        order.shipperId = shipperId;
        order.status = "assigned";
        
        await order.save();

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