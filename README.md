# 🍲 Bep Viet - Multi-platform E-Commerce Culinary Ecosystem

[![Backend](https://img.shields.io/badge/Backend-NodeJS%20%7C%20ExpressJS-green)](https://github.com/Quankun1211/Menu_backend)
[![Database](https://img.shields.io/badge/Database-MongoDB-brightgreen)](https://www.mongodb.com/)
[![AI-Integration](https://img.shields.io/badge/AI-Groq%20API-orange)](https://groq.com/)
[![Status](https://img.shields.io/badge/Status-Migrating%20to%20Python-blue)]()

## 📌 Project Overview
**Bep Viet** is a comprehensive food delivery and culinary discovery ecosystem. It serves as a bridge for users to explore Vietnamese specialties with a seamless experience across Mobile and Web interfaces. 

This repository houses the **Core Backend System**, which orchestrates operations for a three-sided marketplace: **Customers, Shippers, and Administrators.**

---

## 🏗 System Architecture & Tech Stack

### **Backend Core**
- **Runtime:** Node.js & Express.js
- **Real-time Engine:** Socket.io for bi-directional communication.
- **Security:** JWT (Access & Refresh Tokens), Bcrypt for password hashing.
- **Storage:** Cloudinary for high-performance image hosting.
- **Communication:** Nodemailer for OTP and transaction emails.

### **Fintech & AI Integration**
- **Payment:** VNPay Sandbox integration for automated, secure transactions.
- **AI Engine:** Groq API powering a Smart Chatbot for culinary and menu consultation.

### **Database**
- **Primary DB:** MongoDB (NoSQL) for flexible menu and order schema management.

---

## 🚀 Key Modules & Functional Details

### 1. Multi-platform Orchestration
The backend provides unified API endpoints serving three distinct frontends:
* **User Mobile App:** Discovery, ordering, and AI consultation.
* **Shipper Mobile App:** Order management and real-time navigation.
* **Web Admin Dashboard:** Centralized management of products, menus, and business analytics.

### 2. Real-time Operations (Socket.io)
Integrated a high-concurrency event handler to manage:
* **Instant Order Tracking:** Real-time status updates for customers.
* **Live Location Sharing:** Synchronizing coordinates between Shippers, Users, and Admins during the delivery lifecycle.

### 3. Smart Features & Personalization
* **AI Smart Chatbot:** An integrated Groq-powered assistant that provides real-time recipe advice and menu suggestions based on user queries.
* **Recommendation Engine:** Developed a logic layer that analyzes **viewing history and user behavior** to deliver a personalized "For You" food discovery experience.

### 4. Data Management & Analytics
* **Inventory Control:** Centralized management of products, categories, and ingredients.
* **Business Intelligence:** Built custom aggregation pipelines to provide **real-time data visualization** for revenue, order volume, and growth analytics on the Admin Dashboard.

### 5. Fintech & Security
* **Automated Payment:** Secure checkout flow via **VNPay Sandbox**.
* **Account Safety:** Implemented a multi-step verification process including **OTP via Email** for account recovery and sensitive transactions.

---

## 📂 Project Structure
```text
├── src/
│   ├── config/         # Database, Cloudinary, VNPay, and Groq API configs
│   ├── controllers/    # Core logic: Order, Payment, User, Menu, AI Chatbot
│   ├── models/         # MongoDB Schemas (Dish, Order, User, Transaction, Ingredient)
│   ├── routes/         # API Gateways for Mobile and Web
│   ├── middlewares/    # JWT Validation, Role-based Access Control (RBAC)
│   ├── services/       # Socket.io events, Nodemailer, AI consultation logic
│   └── utils/          # Data formatters and helper functions
├── .env                # Environment variables
└── server.js           # Main entry point
