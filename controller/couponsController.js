import { Coupons } from "../models/couponsModel.js";
import { Order } from "../models/ordersModel.js";
import { UserCoupon } from "../models/userCouponModel.js";
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      type,
      value,
      maxDiscount = 0,
      minOrderValue = 0,
      usageLimit,
      userLimit = 1,
      startDate,
      endDate,
    } = req.body;

    if (!code || !type || !value || !usageLimit || !startDate || !endDate) {
      return res.status(400).json({
        code: 400,
        message: "Thiếu dữ liệu tạo mã giảm giá",
      });
    }

    const existed = await Coupons.findOne({ code: code.toUpperCase() });
    if (existed) {
      return res.status(400).json({
        code: 400,
        message: "Mã giảm giá đã tồn tại",
      });
    }

    const coupon = await Coupons.create({
      code: code.toUpperCase(),
      type,
      value,
      maxDiscount,
      minOrderValue,
      applicableProducts: [],      
      applicableCategories: [],    
      usageLimit,
      userLimit,
      startDate,
      endDate,
      isActive: true,
    });

    return res.status(201).json({
      code: 201,
      message: "Tạo mã giảm giá thành công",
      data: coupon,
    });
  } catch (error) {
    console.error("createCoupon error:", error);
    return res.status(500).json({ code: 500 });
  }
};
export const applyCoupon = async (req, res) => {
  try {
    const { code, items, totalAmount } = req.body;
    const userId = req.user.id;

    if (!code || !items?.length) {
      return res.status(400).json({ code: 400, message: "Thiếu dữ liệu" });
    }

    const upperCode = code.toUpperCase();

    const coupon = await getOrSetCache(`coupon:info:${upperCode}`, async () => {
      return await Coupons.findOne({ code: upperCode, isActive: true });
    }, 600); 

    if (!coupon) return res.status(404).json({ code: 404, message: "Mã giảm giá không tồn tại" });

    const userCoupon = await UserCoupon.findOne({ userId, couponId: coupon._id });
    if (!userCoupon) return res.status(403).json({ code: 403, message: "Bạn không sở hữu mã này" });

    if (userCoupon.isUsed) {
      const activeOrder = await Order.findOne({ 
        userId, 
        couponCode: coupon.code, 
        paymentStatus: { $in: ['pending', 'paid'] } 
      });
      
      if (activeOrder) {
        return res.status(400).json({ code: 400, message: "Bạn đã sử dụng mã này rồi" });
      }
    }

    const now = new Date();
    if (new Date(coupon.startDate) > now || new Date(coupon.endDate) < now) {
      return res.status(400).json({ code: 400, message: "Mã đã hết hạn" });
    }

    if (coupon.usedCount >= coupon.usageLimit && !coupon.allowedUsers.includes(userId)) {
      return res.status(400).json({ code: 400, message: "Mã đã hết lượt dùng trên hệ thống" });
    }

    if (totalAmount < coupon.minOrderValue) {
      return res.status(400).json({ code: 400, message: `Đơn tối thiểu ${coupon.minOrderValue}đ` });
    }

    let applicableAmount = totalAmount;
    if (coupon.applicableProducts?.length > 0) {
      applicableAmount = items
        .filter(i => coupon.applicableProducts.some(p => p.toString() === i.productId))
        .reduce((sum, i) => sum + (i.price * i.quantity), 0);
    }

    if (applicableAmount <= 0) return res.status(400).json({ code: 400, message: "Sản phẩm không áp dụng mã" });

    let discountAmount = 0;
    if (coupon.type === "fixed") discountAmount = coupon.value;
    else if (coupon.type === "percentage") discountAmount = (applicableAmount * coupon.value) / 100;
    
    if (coupon.maxDiscount > 0) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    discountAmount = Math.min(discountAmount, totalAmount);

    return res.status(200).json({
      code: 200,
      data: {
        code: coupon.code,
        couponId: coupon._id,
        discountAmount: -discountAmount,
        finalAmount: totalAmount - discountAmount,
      },
    });
  } catch (error) {
    console.error("Apply Coupon Error:", error);
    return res.status(500).json({ code: 500, message: "Lỗi hệ thống" });
  }
};