import crypto from "crypto";

const getSecret = () => process.env.DELIVERY_OTP_SECRET || process.env.JWT_SECRET;

export const createDeliveryOtp = () => {
  const code = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHmac("sha256", getSecret()).update(code).digest("hex");
  return {
    code,
    otpHash,
    otpExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  };
};

export const verifyDeliveryOtp = (code, hash) => {
  if (!code || !hash) return false;
  const candidate = crypto.createHmac("sha256", getSecret()).update(String(code)).digest("hex");
  const left = Buffer.from(candidate, "hex");
  const right = Buffer.from(hash, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
