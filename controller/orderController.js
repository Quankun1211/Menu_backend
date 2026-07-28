import mongoose from "mongoose";
import { Cart } from "../models/cartsModel.js"
import { CartItems } from "../models/cartsItemModel.js"
import { Order } from "../models/ordersModel.js";
import { OrderItem } from "../models/orderItemsModel.js";
import { emitOrderUpdated } from "../utils/orderRealtime.js";
import { Product } from "../models/productsModel.js"
import { Special } from "../models/specialModel.js"
import { Coupons } from "../models/couponsModel.js"
import { refundOrderLogic } from "../utils/vnpayRefund.js"; 
import { UserCoupon } from "../models/userCouponModel.js";
import { Transaction } from '../models/transactionModel.js';
import { sendInternalNotification } from "./notificationController.js";
import crypto from 'crypto';

const enrichOrderItems = async (orderItems) => {
  if (!orderItems.length) return [];

  const productIds = [...new Set(orderItems.map((item) => item.productId?.toString()).filter(Boolean))];
  const [products, specials] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select("name images unit").lean(),
    Special.find({ _id: { $in: productIds } }).select("name images unit").lean(),
  ]);
  const productMap = new Map(products.map((item) => [item._id.toString(), item]));
  const specialMap = new Map(specials.map((item) => [item._id.toString(), item]));

  return orderItems.map((item) => {
    const id = item.productId?.toString();
    const catalogItem = item.itemType === "Special"
      ? specialMap.get(id)
      : item.itemType === "Product"
        ? productMap.get(id)
        : productMap.get(id) || specialMap.get(id);

    return {
      ...item,
      resolvedProduct: catalogItem || null,
    };
  });
};
import qs from 'qs';
import { sortObject } from '../utils/helper.js';
import { validateAndCalculateCoupon } from "../utils/helper.js";
import { createPaymentUrl } from "../services/createPaymentUrl.js";
import { triggerAIUpdate } from "../utils/trackingUserBehavior.js";

import { UserBehavior } from "../models/userBehaviorModel.js";
import { Address } from "../models/addressModel.js";
import { getShippingFeeValue } from "./configController.js";

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let isCommitted = false;

  try {
    const userId = req.user.id;
    const { items, address, couponCode, source, paymentMethod = "cod", platform = "web" } = req.body;
    if (!["cod", "vnpay"].includes(paymentMethod)) throw new Error("Phương thức thanh toán không hợp lệ");
    const ownedAddress = await Address.findOne({ _id: address, userId }).session(session);
    if (!ownedAddress) throw new Error("Địa chỉ giao hàng không hợp lệ");
    const shippingFee = await getShippingFeeValue(session);

    if (!items?.length) throw new Error("Giỏ hàng trống");

    const productIds = items.map(i => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).populate("salePercent").session(session);
    const specials = await Special.find({ _id: { $in: productIds } }).populate("salePercent").session(session);

    let subTotal = 0;
    const orderItems = [];
    const now = new Date();

    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.productId)
        || specials.find(p => p._id.toString() === item.productId);
      const itemType = product?.constructor.modelName === "Special" ? "Special" : "Product";
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
        itemType,
        productName: product.name,
        productImage: product.images || "",
        productUnit: product.unit || "",
        originalPrice: product.price,
        salePercent,
        price: finalPrice,
        quantity: item.quantity
      });

      const ItemModel = itemType === "Special" ? Special : Product;
      const stockUpdate = await ItemModel.updateOne(
        { _id: product._id, stock: { $gte: item.quantity }, isActive: true },
        { $inc: { stock: -item.quantity, soldCount: item.quantity } },
        { session }
      );
      if (stockUpdate.modifiedCount !== 1) {
        throw new Error(`Sản phẩm ${product.name} vừa hết hàng`);
      }
    }

    let couponCodeUsed = null;
    let couponDiscount = 0;
    let couponIdUsed = null;
    
    if (couponCode) {
      const couponResult = await validateAndCalculateCoupon({ 
        code: couponCode, 
        items: orderItems, 
        totalAmount: subTotal,
        userId,
        session
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
      shippingFee,
      address,
      source,
      paymentMethod,
      paymentStatus: finalTotalPrice === 0 ? "paid" : "pending",
      paymentExpiresAt: paymentMethod === "vnpay" ? new Date(Date.now() + 15 * 60 * 1000) : null
    }], { session });

    const itemsWithOrderId = orderItems.map(i => ({ ...i, orderId: order._id }));
    await OrderItem.insertMany(itemsWithOrderId, { session });
    await Transaction.create([{
      orderId: order._id,
      userId,
      amount: finalTotalPrice,
      currency: "VND",
      paymentMethod,
      status: finalTotalPrice === 0 ? "completed" : "pending",
      ipAddress: req.ip,
    }], { session });

    if (source === "cart" && (paymentMethod === "cod" || finalTotalPrice === 0)) {
      const cart = await Cart.findOne({ userId }).session(session);
      if (cart) {
        await CartItems.deleteMany({ cartId: cart._id, productId: { $in: productIds } }, { session });
      }
    }

    await session.commitTransaction();
    isCommitted = true;
    session.endSession();

    let paymentUrl;
    if (finalTotalPrice > 0 && paymentMethod === "vnpay") {
      try {
        paymentUrl = await createPaymentUrl({
          orderId: order._id,
          amount: finalTotalPrice,
          ip: req.ip,
          platform,
        });
      } catch (paymentError) {
        try {
          await releasePendingOrderInventory(order._id, "payment_url_creation_failed");
        } catch (releaseError) {
          console.error("Failed to release inventory after VNPay URL error:", releaseError.message);
        }
        throw new Error(`Không thể khởi tạo thanh toán VNPay: ${paymentError.message}`);
      }
    }

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
export const releasePendingOrderInventory = async (orderId, reason = "payment_failed") => {
  const releaseSession = await mongoose.startSession();
  try {
    return await releaseSession.withTransaction(async () => {
      const order = await Order.findOneAndUpdate(
        { _id: orderId, paymentStatus: "pending", inventoryReleasedAt: null },
        {
          paymentStatus: "failed",
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: reason,
          inventoryReleasedAt: new Date(),
        },
        { new: true, session: releaseSession },
      );
      if (!order) return false;
      const items = await OrderItem.find({ orderId }).session(releaseSession);
      for (const item of items) {
        const ItemModel = item.itemType === "Special" ? Special : Product;
        await ItemModel.updateOne(
          { _id: item.productId },
          { $inc: { stock: item.quantity, soldCount: -item.quantity } },
          { session: releaseSession },
        );
      }
      await Transaction.updateOne(
        { orderId },
        { status: "failed", "gatewayDetails.responseCode": reason },
        { session: releaseSession },
      );
      return true;
    });
  } finally {
    await releaseSession.endSession();
  }
};

export const expirePendingPayments = async () => {
  const orders = await Order.find({
    paymentMethod: "vnpay",
    paymentStatus: "pending",
    paymentExpiresAt: { $lte: new Date() },
    inventoryReleasedAt: null,
  }).select("_id").limit(100);
  for (const order of orders) {
    await releasePendingOrderInventory(order._id, "payment_expired");
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

    const paidAmount = Number(vnp_Params["vnp_Amount"]) / 100;
    if (!Number.isFinite(paidAmount) || paidAmount !== order.totalPrice) {
      return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
    }
    if (process.env.VNP_TMN_CODE && vnp_Params["vnp_TmnCode"] !== process.env.VNP_TMN_CODE) {
      return res.status(200).json({ RspCode: "97", Message: "Invalid merchant" });
    }

    if (order.paymentStatus !== 'pending') {
      console.warn("⚠️ Warning: Order was already processed (Not in pending status)");
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (rspCode === '00') {
      console.log("💰 Payment Success (Code 00). Updating Database...");
      
      const paymentSession = await mongoose.startSession();
      paymentSession.startTransaction();
      try {
      if (order.couponCode) {
        const coupon = await Coupons.findOne({ code: order.couponCode }).session(paymentSession);
        if (coupon) {
          const couponUpdate = await Coupons.updateOne(
            { _id: coupon._id, usedCount: { $lt: coupon.usageLimit } },
            { $inc: { usedCount: 1 } },
            { session: paymentSession },
          );
          if (couponUpdate.modifiedCount !== 1) throw new Error("Coupon usage limit reached");
          await UserCoupon.updateOne(
            { userId: order.userId, couponId: coupon._id }, 
            { $set: { isUsed: true, usedAt: new Date() } },
            { session: paymentSession }
          );
          console.log("✅ Coupon marked as used");
        }
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, paymentStatus: "pending", inventoryReleasedAt: null },
        { paymentStatus: 'paid', status: 'pending', paidAt: new Date() },
        { new: true, session: paymentSession }
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
        { session: paymentSession }
      );
      if (!updatedOrder) throw new Error("Order already processed");

      if (order.source === "cart") {
        const cart = await Cart.findOne({ userId: order.userId }).session(paymentSession);
        if (cart) {
          const paidItems = await OrderItem.find({ orderId: order._id })
            .select("productId")
            .session(paymentSession);
          await CartItems.deleteMany(
            {
              cartId: cart._id,
              productId: { $in: paidItems.map((item) => item.productId) },
            },
            { session: paymentSession },
          );
        }
      }
      await paymentSession.commitTransaction();
      } catch (paymentError) {
        await paymentSession.abortTransaction();
        throw paymentError;
      } finally {
        await paymentSession.endSession();
      }
      console.log("✅ Transaction record created/updated");

      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    } else {
      console.warn(`❌ Payment Failed/Cancelled. Code: ${rspCode}`);
      await releasePendingOrderInventory(orderId, `vnpay_${rspCode}`);
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
    const currentPage = Number(req.query.page || 1);
    const pageSize = Number(req.query.limit || 10);
    const skip = (currentPage - 1) * pageSize;
    const filter = { userId };
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;

    const [orders, totalItems] = await Promise.all([
      Order.find(filter)
        .populate("address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Order.countDocuments(filter),
    ]);

    if (!orders.length) {
      return res.status(200).json({
        code: 200,
        data: [],
        pagination: { totalItems: 0, totalPages: 0, currentPage, pageSize, hasNextPage: false },
      });
    }

    const orderIds = orders.map(o => o._id);

    const rawOrderItems = await OrderItem.find({
      orderId: { $in: orderIds }
    })
      .lean();
    const allOrderItems = await enrichOrderItems(rawOrderItems);

    const itemsByOrder = {};
    for (const item of allOrderItems) {
      const oid = item.orderId.toString();
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push({
        productId: item.resolvedProduct?._id || item.productId,
        name: item.resolvedProduct?.name || item.productName,
        image: item.resolvedProduct?.images || item.productImage || null,
        unit: item.resolvedProduct?.unit || item.productUnit || null,
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
      data: result,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage,
        pageSize,
        hasNextPage: currentPage * pageSize < totalItems,
      },
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

    const rawOrderItems = await OrderItem.find({ orderId }).lean();
    const orderItems = await enrichOrderItems(rawOrderItems);

    const items = orderItems.map(item => ({
      productId: item.resolvedProduct?._id || item.productId,
      name: item.resolvedProduct?.name || item.productName,
      image: item.resolvedProduct?.images || item.productImage || null,
      unit: item.resolvedProduct?.unit || item.productUnit || null,
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
      const ItemModel = item.itemType === "Special" ? Special : Product;
      await ItemModel.updateOne(
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
    emitOrderUpdated(req.app.get("io"), order);
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
