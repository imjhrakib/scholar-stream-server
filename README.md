# ⚙️ ScholarStream – Server Side

## 🔗 Live Server URL

👉 [https://scholar-server-lemon.vercel.app/]

## 🎯 Server Purpose

This server handles all backend operations for the ScholarStream platform. It provides secure REST APIs for authentication, scholarship management, applications, payments, reviews, and role-based access control for Students, Moderators, and Admins.

## 🚀 Key Responsibilities

- 🔐 JWT-based API authentication & authorization
- 👥 Role verification middleware (Admin & Moderator)
- 🎓 Scholarship CRUD operations
- 📝 Scholarship application management
- 💳 Stripe payment intent & payment verification
- ⭐ Reviews & ratings management
- 🔍 Server-side search, filter, sort & pagination

## 📦 NPM Packages Used

- express
- cors
- mongodb
- jsonwebtoken
- stripe
- dotenv

## 🔒 Environment Variables

The following environment variables are used and secured:

- `MONGODB_URI`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `FIREBASE_SERVICE_KEY`

> ⚠️ All sensitive credentials are stored securely using environment variables.

---
