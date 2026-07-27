import crypto from "crypto";
import { logger } from "../utils/logger.js";

export const requestLogger = (req, res, next) => {
  req.requestId = req.get("x-request-id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  const startedAt = Date.now();
  res.on("finish", () => logger.info("http_request", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl.split("?")[0],
    status: res.statusCode,
    durationMs: Date.now() - startedAt,
  }));
  next();
};

export const notFoundHandler = (req, res) =>
  res.status(404).json({ success: false, message: "API endpoint không tồn tại" });

export const errorHandler = (error, req, res, _next) => {
  logger.error("unhandled_error", {
    requestId: req.requestId,
    name: error.name,
    message: error.message,
  });
  const status = error.name === "ValidationError" ? 400 : (error.status || 500);
  res.status(status).json({
    success: false,
    message: status === 500 ? "Lỗi hệ thống" : error.message,
    requestId: req.requestId,
  });
};
