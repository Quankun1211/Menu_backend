import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

export const trackViewCategory = async (userId, categoryId) => {
  const cooldown = 30 * 60 * 1000 
  const now = new Date()

  const user = await User.findById(userId)
  if (!user) return

  const history = user.viewHistory.find(
    h => h.categoryId.toString() === categoryId.toString()
  )

  if (history) {
    if (now - history.lastViewedAt > cooldown) {
      history.viewCount += 1
      history.lastViewedAt = now
    }
  } else {
    user.viewHistory.push({
      categoryId,
      viewCount: 1,
      lastViewedAt: now,
    })
  }

  await user.save()
  console.log(user)
}

export const getMe = async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy thông tin người dùng" });
        }

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
                avatar: user.avatar || null,
                isOnline: user.isOnline
            }
        });
    } catch (error) {
        console.error("Lỗi trong hàm getMe:", error.message);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};