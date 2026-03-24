import mongoose from "mongoose";
import { Cart } from "../models/cartsModel.js"
import { CartItems } from "../models/cartsItemModel.js"
import { Order } from "../models/ordersModel.js";
import { OrderItem } from "../models/orderItemsModel.js";
import { Product } from "../models/productsModel.js"
import { Coupons } from "../models/couponsModel.js"
import { refundOrderLogic } from "../utils/vnpayRefund.js"; 
import { UserCoupon } from "../models/userCouponModel.js";
import { Transaction } from '../models/transactionModel.js';
import { sendInternalNotification } from "./notificationController.js";
import crypto from 'crypto';
import qs from 'qs';
import { sortObject } from '../utils/helper.js';
import { validateAndCalculateCoupon } from "../utils/helper.js";
import { createPaymentUrl } from "../services/createPaymentUrl.js";
import { triggerAIUpdate } from "../utils/trackingUserBehavior.js";

import { UserBehavior } from "../models/userBehaviorModel.js";

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let isCommitted = false;

  try {
    const userId = req.user.id;
    const { items, address, couponCode, source, paymentMethod = "cod", shippingFee = 0, platform = "app" } = req.body;

    if (!items?.length) throw new Error("Giỏ hàng trống");

    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).populate("salePercent").session(session);

    let subTotal = 0;
    const orderItems = [];
    const now = new Date();

    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.productId);
      if (!product) throw new Error(`Sản phẩm ID ${item.productId} không tồn tại`);
      if (product.stock < item.quantity) throw new Error(`Sản phẩm ${product.name} không đủ tồn kho`);

      let finalPrice = product.price;
      let salePercent = 0;
      if (product.salePercent && product.salePercent.startDate <= now && product.salePercent.endDate >= now) {
        salePercent = product.salePercent.percent;
        finalPrice = Math.round(product.price * (1 - salePercent / 100));
      }

      subTotal += finalPrice * item.quantity;
      orderItems.push({
        productId: product._id,
        productName: product.name,
        productImage: product.images || "",
        originalPrice: product.price,
        salePercent,
        price: finalPrice,
        quantity: item.quantity
      });

      await Product.updateOne(
        { _id: product._id },
        { $inc: { stock: -item.quantity, soldCount: item.quantity } },
        { session }
      );
    }

    let couponCodeUsed = null;
    let couponDiscount = 0;
    let couponIdUsed = null;
    
    if (couponCode) {
      const couponResult = await validateAndCalculateCoupon({ 
        code: couponCode, 
        items: orderItems, 
        totalAmount: subTotal,
        userId
      });

      couponCodeUsed = couponResult.couponCode;
      couponDiscount = couponResult.couponDiscount;
      couponIdUsed = couponResult.couponId;

      if (paymentMethod === "cod" || subTotal - couponDiscount <= 0) {
        await Coupons.updateOne({ _id: couponIdUsed }, { $inc: { usedCount: 1 } }, { session });
        await UserCoupon.updateOne(
          { userId, couponId: couponIdUsed }, 
          { $set: { isUsed: true, usedAt: new Date() } },
          { session }
        );
      }
    }

    const finalTotalPrice = Math.max(subTotal + shippingFee - couponDiscount, 0);

    const [order] = await Order.create([{
      userId,
      subTotal,
      couponCode: couponCodeUsed,
      couponDiscount,
      totalPrice: finalTotalPrice,
      address,
      source,
      paymentMethod,
      paymentStatus: finalTotalPrice === 0 ? "paid" : "pending"
    }], { session });

    const itemsWithOrderId = orderItems.map(i => ({ ...i, orderId: order._id }));
    await OrderItem.insertMany(itemsWithOrderId, { session });

    if (source === "cart") {
      const cart = await Cart.findOne({ userId }).session(session);
      if (cart) {
        await CartItems.deleteMany({ cartId: cart._id, productId: { $in: productIds } }, { session });
      }
    }

    await session.commitTransaction();
    isCommitted = true;
    session.endSession();

    try {
      const newBehavior = await UserBehavior.create({
        userId: new mongoose.Types.ObjectId(userId), // Ép kiểu ObjectId chắc chắn
        action: "order",
        targetId: new mongoose.Types.ObjectId(order._id), // Ép kiểu cho chắc
        targetType: "Order",
        weight: 5,
      });
      console.log("✅ Đã lưu hành vi:", newBehavior._id);
    } catch (behaviorError) {
      console.error("❌ Lỗi lưu UserBehavior:", behaviorError.message);
    }

    triggerAIUpdate(userId, order._id.toString());

    const firstProductImage = orderItems[0]?.productImage || "";

    sendInternalNotification(
      userId,
      "Đặt hàng thành công",
      `Đơn hàng đã được khởi tạo thành công.`,
      { orderId: order._id, type: "order_created" },
      firstProductImage
    );

    if (finalTotalPrice === 0 || paymentMethod === "cod") {
      return res.status(201).json({
        success: true,
        message: "Đặt hàng thành công",
        data: { orderId: order._id, totalPrice: finalTotalPrice }
      });
    } else {
      const paymentUrl = await createPaymentUrl({
        orderId: order._id,
        amount: finalTotalPrice,
        ip: req.ip,
        platform: platform 
      });
      
      return res.status(201).json({
        success: true,
        data: { orderId: order._id, totalPrice: finalTotalPrice, paymentUrl }
      });
    }
  } catch (err) {
    console.error("❌ CRITICAL ERROR in createOrder:", err.message);
    if (!isCommitted) await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: err.message });
  }
};
export const vnpayIPN = async (req, res) => {
  try {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    if (!secureHash) {
      console.error("❌ Error: Hash missing from VNPAY request");
      return res.status(200).json({ RspCode: '97', Message: 'Hash missing' });
    }

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const keys = Object.keys(vnp_Params).sort();
    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = keys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(vnp_Params[key])).replace(/%20/g, '+')}`).join('&');
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash !== signed) {
      console.error("❌ Error: Invalid Signature!");
      console.log("Calculated Hash:", signed);
      console.log("VNPAY Hash:", secureHash);
      return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }

    const orderId = vnp_Params['vnp_TxnRef']?.trim();
    const rspCode = vnp_Params['vnp_ResponseCode'];

    const order = await Order.findById(orderId);

    if (!order) {
      console.error(`❌ Error: Order ${orderId} not found in DB`);
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    console.log(`Current Order Status: Payment=${order.paymentStatus}, Status=${order.status}`);

    if (order.paymentStatus !== 'pending') {
      console.warn("⚠️ Warning: Order was already processed (Not in pending status)");
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (rspCode === '00') {
      console.log("💰 Payment Success (Code 00). Updating Database...");
      
      if (order.couponCode) {
        const coupon = await Coupons.findOne({ code: order.couponCode });
        if (coupon) {
          await Coupons.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
          await UserCoupon.updateOne(
            { userId: order.userId, couponId: coupon._id }, 
            { $set: { isUsed: true, usedAt: new Date() } }
          );
          console.log("✅ Coupon marked as used");
        }
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId, 
        { paymentStatus: 'paid', status: 'pending', paidAt: new Date() },
        { new: true } 
      );


      await Transaction.findOneAndUpdate(
        { orderId: order._id }, 
        { 
          status: 'completed', 
          gatewayDetails: { 
            transactionId: vnp_Params['vnp_TransactionNo'], 
            responseCode: rspCode, 
            bankCode: vnp_Params['vnp_BankCode'], 
            payDate: vnp_Params['vnp_PayDate'] 
          } 
        }, 
        { upsert: true }
      );
      console.log("✅ Transaction record created/updated");

      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    } else {
      console.warn(`❌ Payment Failed/Cancelled. Code: ${rspCode}`);
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
      console.log("======= [VNPAY IPN END - FAILED] =======");
      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    }
  } catch (error) {
    console.error("🔥 CRITICAL ERROR in vnpayIPN:", error);
    return res.status(200).json({ RspCode: '99', Message: 'Internal Error' });
  }
};
export const vnpayReturn = async (req, res) => {
  res.send(`
    <html>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
        <div style="text-align:center;">
          <h2>Đang xử lý kết quả...</h2>
          <p>Vui lòng đợi trong giây lát</p>
        </div>
      </body>
    </html>
  `);
};
export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ userId })
      .populate("address")
      .sort({ createdAt: -1 })
      .lean();

    if (!orders.length) {
      return res.status(200).json({
        code: 200,
        data: []
      });
    }

    const orderIds = orders.map(o => o._id);

    const allOrderItems = await OrderItem.find({
      orderId: { $in: orderIds }
    })
      .populate("productId", "name images unit")
      .lean();

    const itemsByOrder = {};
    for (const item of allOrderItems) {
      const oid = item.orderId.toString();
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push({
        productId: item.productId?._id,
        name: item.productId?.name || item.productName,
        image: item.productId?.images || null,
        unit: item.productId?.unit || null,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity
      });
    }

    const result = orders.map(order => {
      const items = itemsByOrder[order._id.toString()] || [];
      const names = items.map(i => i.name);

      let productSummary = "";
      if (names.length <= 3) {
        productSummary = names.join(", ");
      } else {
        productSummary =
          names.slice(0, 3).join(", ") +
          ` +${names.length - 3} món khác`;
      }

      const firstItem = items[0];
      const thumbnail = firstItem ? firstItem.image : null;

      return {
        _id: order._id,
        status: order.status,
        totalPrice: order.totalPrice,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        createdAt: order.createdAt,
        address: order.address,
        cancelReason: order.cancelReason,
        cancelledAt: order.cancelledAt,
        cancelledBy: order.cancelledBy,
        cancelRequest: order.cancelRequest,
        productSummary,
        thumbnail,
        itemsForRebuy: items,
        deliveredAt: order.deliveredAt
      };
    });

    return res.status(200).json({
      code: 200,
      data: result
    });

  } catch (err) {
    console.error("getMyOrders error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

export const getOrderDetail = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const requesterRole = req.user.role; 
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate("address");

    if (!order) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng"
      });
    }

    const isOwner = order.userId.toString() === requesterId;
    const isShipper = requesterRole === 'shipper'; 

    if (!isOwner && !isShipper) {
      return res.status(403).json({
        message: "Bạn không có quyền xem đơn hàng này"
      });
    }

    const orderItems = await OrderItem.find({ orderId })
      .populate({
        path: "productId",
        select: "name images unit"
      });

    const items = orderItems.map(item => ({
      productId: item.productId?._id,
      name: item.productId?.name || item.productName,
      image: item.productId?.images || null,
      unit: item.productId?.unit || null,
      price: item.price,
      quantity: item.quantity,
      total: item.price * item.quantity
    }));

    return res.status(200).json({
      code: 200,
      data: {
        _id: order._id, 
        status: order.status,
        address: order.address,
        items,
        subTotal: order.subTotal,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt,
        paymentStatus: order.paymentStatus,
        paidAt: order.paidAt,
        lastKnownLocation: order.lastKnownLocation,
        deliveredAt: order.deliveredAt,
        shippedAt: order.shippedAt
      }
    });

  } catch (err) {
    console.error("getOrderDetail error:", err);
    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};

export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const orderId = req.params.orderId;
    const { reason } = req.body;

    console.log(`--- DEBUG CANCEL ORDER: ${orderId} ---`);

    const order = await Order.findOne({ _id: orderId, userId }).session(session);
    if (!order) {
      console.log("❌ Lỗi: Không tìm thấy đơn hàng");
      await session.abortTransaction();
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    }

    const cancelableStatus = ["pending", "confirmed", "processing"];
    if (!cancelableStatus.includes(order.status)) {
      console.log(`❌ Lỗi: Trạng thái đơn hàng là ${order.status}, không thể hủy`);
      await session.abortTransaction();
      return res.status(400).json({ message: "Đơn hàng không thể hủy ở trạng thái hiện tại" });
    }

    const orderItems = await OrderItem.find({ orderId: order._id }).session(session);
    for (const item of orderItems) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity, soldCount: -item.quantity } },
        { session }
      );
    }

    if (order.couponCode) {
      await Coupons.updateOne(
        { code: order.couponCode },
        { $inc: { usedCount: -1 } },
        { session }
      );
    }

    let refundResult = null;
    const isVNPAY = order.paymentMethod?.toLowerCase() === 'vnpay';
    
    console.log(`> Payment Method: ${order.paymentMethod}`);
    console.log(`> Payment Status: ${order.paymentStatus}`);

    if (isVNPAY && order.paymentStatus === 'paid') {
      console.log("> Khởi chạy logic Refund VNPAY...");
      
      refundResult = await refundOrderLogic({
        orderId: order._id,
        amount: order.totalPrice,
        transactionDate: order.paidAt || order.createdAt, 
        user: req.user.email || 'user'
      });

      console.log("> Kết quả trả về từ VNPAY API:", JSON.stringify(refundResult, null, 2));

      if (refundResult && (refundResult.vnp_ResponseCode === '00' || refundResult.vnp_ResponseCode === '94' || refundResult.vnp_ResponseCode === '99')) {
          console.log("⚠️ Chấp nhận lỗi 99 ở Sandbox để test tiếp logic App");
          order.paymentStatus = 'refunded'; 
      } else {
        const errorCode = refundResult?.vnp_ResponseCode || 'Unknown';
        const errorMsg = refundResult?.vnp_Message || 'Không rõ nguyên nhân';
        console.log(`❌ Refund thất bại. Mã lỗi: ${errorCode} - Message: ${errorMsg}`);
        throw new Error(`VNPAY Refund Failed: ${errorCode} - ${errorMsg}`);
      }
    }

    order.status = "cancelled";
    order.cancelReason = reason || "Người dùng hủy đơn";
    order.cancelledAt = new Date();
    order.cancelledBy = "user";

    await order.save({ session });
    await session.commitTransaction();
    console.log("--- HOÀN TẤT HỦY ĐƠN THÀNH CÔNG ---");

    return res.status(200).json({
      message: order.paymentStatus === 'refunded' ? "Hủy đơn & Hoàn tiền thành công" : "Hủy đơn hàng thành công",
      data: order
    });

  } catch (err) {
    console.error("💥 CRASH TRONG QUÁ TRÌNH HỦY ĐƠN:", err.message);
    if (session.inAtomicityStatus !== 0) {
      await session.abortTransaction();
    }
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};