import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AuthSession } from "../models/authSessionModel.js";

export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const csrfCookieOptions = () => ({
  httpOnly: false,
  sameSite: process.env.NODE_ENV === "production" ? "lax" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

export const setCsrfToken = (res, existingToken) => {
  const csrfToken = existingToken || crypto.randomBytes(24).toString("hex");
  res.cookie("csrf_token", csrfToken, csrfCookieOptions());
  return csrfToken;
};

export const issueSession = async (user, res, req, familyId = crypto.randomUUID()) => {
  const accessToken = jwt.sign({
    userId: user._id,
    role: user.role,
    email: user.email,
    name: user.name,
    tokenType: "access",
  }, process.env.JWT_SECRET, { expiresIn: "15m" });

  const jti = crypto.randomBytes(32).toString("hex");
  const refreshToken = jwt.sign({
    userId: user._id,
    familyId,
    jti,
    tokenType: "refresh",
  }, process.env.JWT_SECRET, { expiresIn: "7d" });

  await AuthSession.create({
    userId: user._id,
    familyId,
    tokenHash: hashToken(jti),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    userAgent: req?.get?.("user-agent"),
    ipAddress: req?.ip,
  });

  const cookieBase = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
  res.cookie("jwt", accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
  res.cookie("refresh_token", refreshToken, {
    ...cookieBase,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
  const csrfToken = setCsrfToken(res);
  return { accessToken, refreshToken, csrfToken, familyId, jti };
};

export default issueSession;
