import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";
import { triggerAIUpdate } from "../utils/trackingUserBehavior.js";
import bcryptjs from "bcryptjs";

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
        triggerAIUpdate(user._id)

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.emailNeedsVerification ? null : user.email,
                phone: user.phone || null,
                emailNeedsVerification: Boolean(user.emailNeedsVerification),
                role: user.role,
                createdAt: user.createdAt,
                avatar: user.avatar || null,
                isOnline: user.isOnline,
                authProviders: (user.authProviders || []).map(({ provider }) => provider),
                lastLoginAt: user.lastLoginAt || null
            }
        });
    } catch (error) {
        console.error("Lỗi trong hàm getMe:", error.message);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");
    if (!user?.password || !(await bcryptjs.compare(currentPassword, user.password))) {
      return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không chính xác" });
    }
    user.password = await bcryptjs.hash(newPassword, 10);
    await user.save();
    return res.status(200).json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể đổi mật khẩu lúc này" });
  }
};

export const updatePushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    const userId = req.user._id; 

    if (!pushToken) {
      return res.status(400).json({ success: false, message: "Thiếu pushToken" });
    }

    await User.findByIdAndUpdate(userId, { pushToken });

    res.status(200).json({
      success: true,
      message: "Cập nhật push token thành công",
    });
  } catch (error) {
    next(error);
  }
};
