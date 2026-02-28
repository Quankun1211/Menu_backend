import { Coupons } from "../models/couponsModel.js";
import { UserCoupon } from "../models/userCouponModel.js";
export const sortObject = (obj) => {
  let sorted = {};
  let keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = obj[key];
  });
  return sorted;
};
export const generateRandomCode = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const validateAndCalculateCoupon = async ({ code, items, totalAmount, userId }) => {
  const coupon = await Coupons.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!coupon) throw new Error("Mã giảm giá không tồn tại");

  const userCoupon = await UserCoupon.findOne({ userId, couponId: coupon._id });
  if (!userCoupon) throw new Error("Bạn không sở hữu mã này trong ví");
  if (userCoupon.isUsed) throw new Error("Mã này đã được bạn sử dụng");

  const now = new Date();
  if (coupon.startDate > now || coupon.endDate < now) throw new Error("Mã đã hết hạn");

  const isAllowed = coupon.allowedUsers?.some(id => id.toString() === userId.toString());
  if (coupon.usedCount >= coupon.usageLimit && !isAllowed) {
    throw new Error("Mã đã hết lượt sử dụng trên hệ thống");
  }

  if (totalAmount < coupon.minOrderValue) {
    throw new Error(`Đơn hàng tối thiểu ${coupon.minOrderValue}đ`);
  }

  let applicableAmount = totalAmount;
  if (coupon.applicableProducts.length > 0) {
    applicableAmount = items
      .filter(i => coupon.applicableProducts.some(p => p.toString() === i.productId.toString()))
      .reduce((sum, i) => sum + (i.price * i.quantity), 0);
  }

  if (applicableAmount <= 0) throw new Error("Mã không áp dụng cho các sản phẩm trong giỏ");

  let discountAmount = 0;
  if (coupon.type === "fixed") {
    discountAmount = coupon.value;
  } else if (coupon.type === "percentage") {
    discountAmount = (applicableAmount * coupon.value) / 100;
  }

  if (coupon.maxDiscount > 0) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  
  // Chốt chặn: Giảm giá tối đa bằng giá trị đơn hàng
  discountAmount = Math.min(discountAmount, totalAmount);

  return {
    couponId: coupon._id,
    couponCode: coupon.code,
    couponDiscount: discountAmount
  };
};