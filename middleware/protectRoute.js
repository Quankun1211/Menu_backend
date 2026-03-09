import { User } from "../models/userModel.js";
import jwt from "jsonwebtoken"

export const protectRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ error: "Bạn chưa đăng nhập" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User không tồn tại" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Token error:", err.name, err.message);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token đã hết hạn" });
    }

    return res.status(401).json({
      error: "Token không hợp lệ hoặc đã bị thay đổi",
    });
  }
};
export const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: "Bạn không có quyền thực hiện hành động này" 
      });
    }
    next();
  };
};
export const optionalProtectRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : req.cookies?.jwt;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
    }
  } catch (err) {
    console.error("Optional auth error (expired or invalid token):", err.message);
  }
  next();
};