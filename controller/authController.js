import { User } from "../models/userModel.js";
import bcryptjs from "bcryptjs"
import {sendOTPEmail} from "../utils/mailer.js"
import { triggerAIUpdate } from "../utils/trackingUserBehavior.js";
import { Notification } from "../models/notification/notificationSchema.js"
import { redisClient } from "../config/redis.js";
import jwt from "jsonwebtoken";
import { AuthSession } from "../models/authSessionModel.js";
import { cookieSecurityOptions, hashToken, issueSession, setCsrfToken } from "../utils/generateToken.js";
const generateRandomAvatar = (username) => {
  const params = [
    'backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf', 
    'backgroundType=gradientLinear,solid',
    'mouth=smile,default'
  ].join('&');

  return `https://api.dicebear.com/7.x/avataaars/png?seed=${username}&${params}`;
};

export const signUp = async (req, res) => {
  try {
    const { name, username, email, password, confirmPassword } = req.body;
  
    if (!name || !username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Mật khẩu không khớp" });
    }

    const existedUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existedUser) {
      return res.status(400).json({ error: "Username hoặc Email đã tồn tại" });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const otp = String((await import("crypto")).randomInt(100000, 1000000));
    const newUser = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      avatar: generateRandomAvatar(username),
      isVerified: false,
    });

    try {
      await sendOTPEmail(email, otp);
      await redisClient.set(`otp:${email}`, otp, { EX: 600 });
    } catch (mailError) {
      await Promise.allSettled([
        redisClient.del(`otp:${email}`),
        User.deleteOne({ _id: newUser._id, isVerified: false }),
      ]);
      throw mailError;
    }

    Notification.create({
      userId: newUser._id,
      title: "Chào mừng bạn mới!",
      body: `Chào mừng ${name} tới với Bếp Việt.`,
      type: 'SYSTEM_UPDATE',
      isRead: false
    }).catch((error) => console.error("Welcome notification error:", error.message));

    return res.status(201).json({
      code: 201,
      message: "Đăng ký thành công. Vui lòng kiểm tra email để nhận mã OTP.",
      data: { email: newUser.email, username: newUser.username },
    });
  } catch (err) {
    console.error("Signup error:", err);
    if (["EMAIL_CONFIGURATION_ERROR", "EMAIL_DELIVERY_ERROR"].includes(err.code)) {
      return res.status(503).json({
        error: "Dịch vụ gửi mã xác thực đang gián đoạn. Vui lòng thử lại sau.",
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp, type } = req.body;
        const attemptsKey = `otp:attempts:${type || "verify"}:${email}`;
        const attempts = await redisClient.incr(attemptsKey);
        if (attempts === 1) await redisClient.expire(attemptsKey, 600);
        if (attempts > 5) {
            return res.status(429).json({ message: "Quá nhiều lần thử OTP" });
        }

        const otpKey = type === "reset" ? `otp:reset:${email}` : `otp:${email}`;
        const storedOtp = await redisClient.get(otpKey);

        if (!storedOtp) {
            return res.status(400).json({ message: "Mã OTP đã hết hạn" });
        }

        if (String(storedOtp) !== String(otp)) {
            return res.status(400).json({ message: "Mã OTP không chính xác" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        if (!user.isVerified) {
            user.isVerified = true;
            await user.save();
        }

        if (type !== 'reset') {
            await redisClient.del(otpKey);
        }
        await redisClient.del(attemptsKey);

        return res.status(200).json({ 
            message: "Xác thực thành công!",
            data: { email: user.email } 
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const resendOTP = async (req, res) => {
    try {
        const { email, type = "verify" } = req.body;
        const cooldownKey = `otp:cooldown:${email}`;
        if (await redisClient.get(cooldownKey)) {
          return res.status(429).json({ message: "Vui lòng chờ trước khi gửi lại OTP" });
        }
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Email không tồn tại" });
        }

        const newOtp = String((await import("crypto")).randomInt(100000, 1000000));
        
        await sendOTPEmail(email, newOtp);
        const otpKey = type === "reset" ? `otp:reset:${email}` : `otp:${email}`;
        await redisClient.set(otpKey, newOtp, { EX: 600 });
        await redisClient.set(cooldownKey, "1", { EX: 60 });
        
        return res.status(200).json({ 
            code: 200,
            message: "Mã OTP mới đang được gửi. Vui lòng kiểm tra hộp thư của bạn." 
        });

    } catch (error) {
      console.error("Resend OTP error:", error);
      if (["EMAIL_CONFIGURATION_ERROR", "EMAIL_DELIVERY_ERROR"].includes(error.code)) {
        return res.status(503).json({
          message: "Dịch vụ gửi mã xác thực đang gián đoạn. Vui lòng thử lại sau.",
        });
      }
      return res.status(500).json({ message: "Lỗi hệ thống khi gửi lại mã." });
    }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "Email không tồn tại trong hệ thống" });
    }

    const otp = String((await import("crypto")).randomInt(100000, 1000000));
    
    await sendOTPEmail(email, otp);
    await redisClient.set(`otp:reset:${email}`, otp, { EX: 600 });

    return res.status(200).json({ 
      message: "Mã OTP đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email." 
    });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    if (["EMAIL_CONFIGURATION_ERROR", "EMAIL_DELIVERY_ERROR"].includes(err.code)) {
      return res.status(503).json({
        error: "Dịch vụ gửi mã xác thực đang gián đoạn. Vui lòng thử lại sau.",
      });
    }
    return res.status(500).json({ error: "Lỗi hệ thống khi yêu cầu đặt lại mật khẩu" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới" });
    }

    const storedOtp = await redisClient.get(`otp:reset:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ error: "Mã OTP đã hết hạn hoặc không tồn tại" });
    }

    if (String(storedOtp) !== String(otp)) {
      return res.status(400).json({ error: "Mã OTP không chính xác" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(newPassword, salt);

    user.password = hashedPassword;
    
    await user.save();

    await redisClient.del(`otp:reset:${email}`);

    return res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (err) {
    console.error("Lỗi reset password:", err.message);
    return res.status(500).json({ error: "Lỗi hệ thống, vui lòng thử lại sau" });
  }
};

export const login = async (req, res) => {
    try {
        const {username, password, clientType} = req.body
        const identifier = username.trim().toLowerCase()
        const user = await User.findOne({
            $or: [
                {username: identifier},
                {email: identifier}
            ]
        })

        if(!user) {
            return res.status(401).json({error: "Tên đăng nhập/email hoặc mật khẩu không đúng"})
        }

        const isPasswordCorrect = await bcryptjs.compare(password, user.password || "")
        if(!isPasswordCorrect) {
            return res.status(401).json({error: "Tên đăng nhập/email hoặc mật khẩu không đúng"})
        }
        if (!user.isVerified) {
          return res.status(403).json({ error: "Tài khoản chưa được xác minh" });
        }
        // Older accounts may not have isActive. Only an explicit false means locked.
        if (user.isActive === false) {
          return res.status(403).json({ error: "Tài khoản đã bị khóa" });
        }
        const session = await issueSession(user, res, req)
        console.log("Login ok");
        triggerAIUpdate(user._id)
        
        res.status(200).json({
            code: 200,
            data: {
              _id: user._id,
              username: user.username,
              email: user.email,
              name: user.name,
              role: user.role,
              csrfToken: session.csrfToken,
              ...(["mobile", "spa"].includes(clientType) && {
                access_token: session.accessToken,
                refresh_token: session.refreshToken,
              }),
            }
        })
    } catch (error) {
        console.log(error.message)
        res.status(500).json({error: "Internal server"})
    }
}

export const logout = async (req, res) => {
    try {
        const rawRefresh = req.cookies?.refresh_token;
        if (rawRefresh) {
          try {
            const decoded = jwt.verify(rawRefresh, process.env.JWT_SECRET);
            await AuthSession.updateOne(
              { tokenHash: hashToken(decoded.jti) },
              {
                revokedAt: new Date(),
                cleanupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            );
          } catch {}
        }
        const cookieSecurity = cookieSecurityOptions();
        res.clearCookie("jwt", cookieSecurity);
        res.clearCookie("refresh_token", { ...cookieSecurity, path: "/api/auth" });
        res.clearCookie("csrf_token", { ...cookieSecurity, path: "/" });
        console.log("Logout ok");
        res.status(200).json({ 
            code: 200,
            message: "Logout successfully" 
        });
    } catch (err) {
        console.log("Error in logout controller", err.message);
        res.status(500).json({ error: "Internal server" });
    }
}

export const getCsrfToken = (req, res) => {
  const csrfToken = setCsrfToken(res, req.cookies?.csrf_token);
  return res.status(200).json({
    success: true,
    data: { csrfToken },
  });
};

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.token;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token is required" });
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.tokenType !== "refresh") return res.status(401).json({ error: "Invalid refresh token" });
    const session = await AuthSession.findOne({ tokenHash: hashToken(decoded.jti) });
    if (!session || session.expiresAt <= new Date()) {
      return res.status(401).json({ error: "Refresh session is unavailable" });
    }
    if (session.revokedAt) {
      await AuthSession.updateMany(
        { familyId: decoded.familyId, revokedAt: null },
        {
          revokedAt: new Date(),
          cleanupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      );
      return res.status(401).json({ error: "Refresh token reuse detected" });
    }
    const user = await User.findById(decoded.userId);
    if (!user || user.isActive === false || !user.isVerified) {
      return res.status(401).json({ error: "Account is unavailable" });
    }
    const rotated = await issueSession(user, res, req, decoded.familyId);
    session.revokedAt = new Date();
    session.cleanupAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    session.replacedByHash = hashToken(rotated.jti);
    await session.save();
    const tokenClient = ["mobile", "spa"].includes(req.body?.clientType) || Boolean(req.body?.token);
    return res.status(200).json({
      code: 200,
      data: {
        refreshed: true,
        csrfToken: rotated.csrfToken,
        ...(tokenClient && {
          access_token: rotated.accessToken,
          refresh_token: rotated.refreshToken,
        }),
      },
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};

export const createSuperAdmin = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Super admin đã tồn tại"
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const superAdmin = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role: "super_admin",
      isVerified: true
    });

    await superAdmin.save();

    res.status(201).json({
      success: true,
      message: "Tạo tài khoản Super Admin thành công"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
