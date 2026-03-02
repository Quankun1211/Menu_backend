import dotenv from "dotenv"
dotenv.config() 
import express from 'express'
import cors from "cors"
import cookieParser from "cookie-parser"
import path from 'path'
import connect from './db/connectDb.js'
import { createServer } from 'http';
import { Server } from 'socket.io';

import adminRoutes from "./routes/adminRoutes.js"
import shipperRoutes from "./routes/shipperRoutes.js"

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

import chatbotRoutes from "./routes/chatbotRoutes.js"

// Menu
import categoryMenuRoutes from "./routes/menuRoutes/categoryMenuRoutes.js"
import ingredientRoutes from "./routes/menuRoutes/ingredientRoutes.js"
import recipeRoutes from "./routes/menuRoutes/recipeRoutes.js"
import menuRoutes from "./routes/menuRoutes/menuRoutes.js"
const app = express()
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});
const PORT = process.env.PORT || 5000
const __dirname = path.resolve()

app.use(cors({
    origin: true, 
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], 
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'] 
}))
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});
io.on("connection", (socket) => {
  socket.on("join_order", (orderId) => {
    socket.join(orderId);
  });

  socket.on("join_shipper_room", (shipperId) => {
    socket.join(shipperId);
  });

  socket.on("order_status_changed_by_shipper", (data) => {
    io.emit("admin_refresh_orders", { orderId: data.orderId });
  });

  socket.on("shipper_request_cancel", (data) => {
    io.emit("admin_refresh_orders", { orderId: data.orderId });
  });
});

// const sendLocationToUser = (orderId, lat, lng) => {
//   io.to(orderId).emit('live_update', {
//     latitude: lat,
//     longitude: lng
//   });
// };

app.use(express.json())
app.use(cookieParser())

connect()

app.get('/', (req, res) => {
  res.status(200).json({message: "Api is running"})
})

app.use("/api/admin", adminRoutes)
app.use("/api/shipper", shipperRoutes)

app.use("/api/auth", authRoutes)
app.use("/api/user", userRoutes)
app.use("/api/category", categoryRoutes)
app.use("/api/product", productRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/favourite", favouriteRoutes)
app.use("/api/address", addressRoutes)
app.use("/api/coupon", couponRoutes)
app.use("/api/order", orderRoutes)
app.use("/api/special", specialRoutes)
app.use("/api/sale", saleRoutes)

app.use("/api/ai", chatbotRoutes)

// Menu
app.use("/api/menu/category", categoryMenuRoutes)
app.use("/api/menu/ingredient", ingredientRoutes)
app.use("/api/menu/recipe", recipeRoutes)
app.use("/api/menu/my-menu", menuRoutes)

app.use((req, res, next) => {
    if (req.url.includes('vnpay')) {
        console.log("🔥 CO DULIEU VNPAY GOI DEN:", req.method, req.url);
    }
    next();
});

app.set('io', io);
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})