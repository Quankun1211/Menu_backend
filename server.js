// Environment variables must be loaded before any imported configuration
// module (Cloudinary, Redis, Firebase, etc.) is evaluated.
import "dotenv/config"
import express from 'express'
import cors from "cors"
import cookieParser from "cookie-parser"
import path from 'path'
import connect from './db/connectDb.js'
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from "jsonwebtoken";
import { User } from "./models/userModel.js";
import { Order } from "./models/ordersModel.js";
import { rateLimit, securityHeaders } from "./middleware/security.js";
import { csrfProtection } from "./middleware/csrf.js";
import { expirePendingPayments } from "./controller/orderController.js";
import { recoverGatewayCompletedRefunds, retryFailedRefunds } from "./controller/orderCancellationController.js";
import { errorHandler, notFoundHandler, requestLogger } from "./middleware/errorHandler.js";
import { validateRequestEnvelope } from "./middleware/requestEnvelope.js";
import { dynamicSitemap } from "./controller/sitemapController.js";

import adminRoutes from "./routes/adminRoutes.js"
import shipperRoutes from "./routes/shipperRoutes.js"
import { startAssignmentRecovery } from "./services/assignmentRecovery.js";

import authRoutes from "./routes/authRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import favouriteRoutes from "./routes/favouriteRoutes.js"
import addressRoutes from "./routes/addressRoutes.js"
import couponRoutes from "./routes/couponRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import specialRoutes from "./routes/specialRoutes.js"
import saleRoutes from "./routes/saleRoutes.js"
import configRoutes from "./routes/configRoutes.js"

import chatbotRoutes from "./routes/chatbotRoutes.js"
import supportChatRoutes from "./routes/supportChatRoutes.js"

// Menu
import categoryMenuRoutes from "./routes/menuRoutes/categoryMenuRoutes.js"
import ingredientRoutes from "./routes/menuRoutes/ingredientRoutes.js"
import recipeRoutes from "./routes/menuRoutes/recipeRoutes.js"
import menuRoutes from "./routes/menuRoutes/menuRoutes.js"

import notificationRoutes from "./routes/notificationRoutes.js"
import userRecipeRoutes from "./routes/userRecipeRoutes.js"
import legacyPaymentCallbackRoutes from "./routes/legacyPaymentCallbackRoutes.js"
import {
  checkoutPreviewV1Routes,
  currentUserV1Routes,
  walletV1Routes,
} from "./routes/v1UtilityRoutes.js"

import { connectRedis } from "./config/redis.js"
import { redisClient } from "./config/redis.js"
import crypto from "crypto";
const app = express()
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(rateLimit({ max: 180 }));
app.use(requestLogger);
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});
const PORT = process.env.PORT || 5000
const __dirname = path.resolve()
const configuredFrontendOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || "").split(","),
].map((origin) => origin?.trim()).filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost',
  'http://localhost:5000',
  'http://localhost:3000',
  ...configuredFrontendOrigins,
  'https://fanciful-dieffenbachia-2f571b.netlify.app', 
  'https://warm-chaja-2bce2f.netlify.app', 
  'https://menu-backend-ve33.onrender.com'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("CORS bị chặn cho origin:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id']
}));
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});
io.use(async (socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const cookieToken = socket.handshake.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("jwt="))
      ?.slice(4);
    const token = authToken || cookieToken;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("_id role isActive");
    if (!user?.isActive) return next(new Error("Unauthorized"));
    socket.user = user;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
io.on("connection", (socket) => {
  socket.join(socket.user._id.toString());
  if (["admin", "super_admin"].includes(socket.user.role)) socket.join("admins");
  if (socket.user.role === "shipper") socket.join(`shipper:${socket.user._id}`);

  socket.on("join_user_room", () => {
    socket.join(socket.user._id.toString());
  });

  socket.on("join_order", async (orderId) => {
    const order = await Order.findById(orderId).select("userId shipperId");
    const allowed = order && (
      order.userId?.equals(socket.user._id) ||
      order.shipperId?.equals(socket.user._id) ||
      ["admin", "super_admin"].includes(socket.user.role)
    );
    if (allowed) socket.join(`order:${orderId}`);
  });

  socket.on("join_shipper_room", () => {
    if (socket.user.role === "shipper") socket.join(`shipper:${socket.user._id}`);
  });

  socket.on("disconnect", () => {
  });
});



app.use(express.json({ limit: "1mb" }))
app.use(cookieParser())
app.use(validateRequestEnvelope)
app.use(csrfProtection)

app.get('/', (req, res) => {
  res.status(200).json({message: "Api is running"})
})
app.get("/sitemap.xml", dynamicSitemap);

// The only unversioned compatibility route is an external VNPay callback.
app.use("/api/order", legacyPaymentCallbackRoutes)

app.use("/api/v1/admin", adminRoutes)
app.use("/api/v1/shippers", shipperRoutes)
app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/users", userRoutes)
app.use("/api/v1/users", currentUserV1Routes)
app.use("/api/v1/categories", categoryRoutes)
app.use("/api/v1/products", productRoutes)
app.use("/api/v1/cart", cartRoutes)
app.use("/api/v1/favourites", favouriteRoutes)
app.use("/api/v1/addresses", addressRoutes)
app.use("/api/v1/coupons", couponRoutes)
app.use("/api/v1/orders", orderRoutes)
app.use("/api/v1/specials", specialRoutes)
app.use("/api/v1/sales", saleRoutes)
app.use("/api/v1/settings", configRoutes)
app.use("/api/v1/chatbot", chatbotRoutes)
app.use("/api/v1/support-chats", supportChatRoutes)
app.use("/api/v1/menu-categories", categoryMenuRoutes)
app.use("/api/v1/ingredients", ingredientRoutes)
app.use("/api/v1/recipes", recipeRoutes)
app.use("/api/v1/user-recipes", userRecipeRoutes)
app.use("/api/v1/menus", menuRoutes)
app.use("/api/v1/notifications", notificationRoutes)
app.use("/api/v1/wallets", walletV1Routes)
app.use("/api/v1/checkout-previews", checkoutPreviewV1Routes)

app.get("/health", async (_req, res) => {
  const mongoReady = (await import("mongoose")).default.connection.readyState === 1;
  res.status(mongoReady ? 200 : 503).json({ status: mongoReady ? "ok" : "degraded", mongo: mongoReady });
});

app.use((req, res, next) => {
    if (req.url.includes('vnpay')) {
        console.log("🔥 CO DULIEU VNPAY GOI DEN:", req.method, req.url);
    }
    next();
});
app.use(notFoundHandler);
app.use(errorHandler);
global._io = io;
app.set('io', io);

const startServer = async () => {
    try {
        await connect(); 
        startAssignmentRecovery(io);

        await connectRedis(); 

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📡 Socket.io is ready`);
        });
        const runPaymentExpiry = async () => {
          const lockToken = crypto.randomUUID();
          let locked = false;
          try {
            if (redisClient.isReady) {
              locked = Boolean(await redisClient.set(
                "lock:payment-expiry",
                lockToken,
                { NX: true, EX: 55 },
              ));
              if (!locked) return;
            }
            for (let batch = 0; batch < 10; batch += 1) {
              const processed = await expirePendingPayments(io);
              if (processed < 100) break;
            }
            await recoverGatewayCompletedRefunds(io);
            await retryFailedRefunds(io);
          } catch (error) {
            console.error("Payment expiry job failed", error.message);
          } finally {
            if (locked && await redisClient.get("lock:payment-expiry") === lockToken) {
              await redisClient.del("lock:payment-expiry");
            }
          }
        };
        runPaymentExpiry();
        setInterval(runPaymentExpiry, 60_000).unref();
    } catch (error) {
        console.error("💥 Failed to start application:", error);
        process.exit(1);
    }
};

startServer();
