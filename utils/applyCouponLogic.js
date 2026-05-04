import { Coupons } from "../models/couponsModel.js";
import { redisClient } from "../config/redis.js";
export const applyCouponLogic = async ({
    code,
    items,
    totalAmount
  }) => {
    const lockKey = `lock:coupon:${code.toUpperCase()}`;

    try {
      const isLocked = await redisClient.set(lockKey, "processing", {
        NX: true,
        EX: 5,
      });

      if (!isLocked) {
        throw new Error("Mã giảm giá đang được xử lý, vui lòng đợi giây lát");
      }

      if (!code || !items?.length)
        throw new Error("Thiếu dữ liệu áp mã");

      const coupon = await Coupons.findOne({
        code: code.toUpperCase(),
        isActive: true,
      });

      if (!coupon) throw new Error("Mã không tồn tại");

      const now = new Date();
      if (coupon.startDate > now || coupon.endDate < now)
        throw new Error("Mã đã hết hạn");

      if (coupon.usedCount >= coupon.usageLimit)
        throw new Error("Mã đã hết lượt sử dụng");

      if (totalAmount < coupon.minOrderValue)
        throw new Error(`Đơn tối thiểu ${coupon.minOrderValue}đ`);

      let discountAmount = 0;

      if (coupon.type === "fixed") {
        discountAmount = coupon.value;
      } else {
        discountAmount = (totalAmount * coupon.value) / 100;
      }

      if (coupon.maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }

      discountAmount = Math.min(discountAmount, totalAmount);

      await redisClient.del(lockKey);

      return {
        couponCode: coupon.code,
        couponDiscount: discountAmount,
        couponId: coupon._id
      };
    } catch (error) {
      await redisClient.del(lockKey);
      throw error;
    }
  };