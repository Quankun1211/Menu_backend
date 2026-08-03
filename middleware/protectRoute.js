import { User } from "../models/userModel.js";
import jwt from "jsonwebtoken"
import { authErrorResponse } from "../config/errorText.js";

export const protectRoute = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : req.cookies?.jwt;

    if (!token) {
      return authErrorResponse(res, "LOGIN_REQUIRED");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.tokenType !== "access") {
      return authErrorResponse(res, "SESSION_INVALID");
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return authErrorResponse(res, "ACCOUNT_NOT_FOUND");
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Token error:", err.name, err.message);

    if (err.name === "TokenExpiredError") {
      return authErrorResponse(res, "SESSION_EXPIRED");
    }

    return authErrorResponse(res, "SESSION_INVALID");
  }
};
export const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return authErrorResponse(res, "PERMISSION_DENIED");
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
    if (decoded.tokenType !== "access") {
      return next();
    }
    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
    }
  } catch (err) {
    console.error("Optional auth error (expired or invalid token):", err.message);
  }
  next();
};
