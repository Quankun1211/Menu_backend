import { User } from "../models/userModel.js";
import bcryptjs from "bcryptjs"
import generateTokenAndSetCookie from "../utils/generateToken.js";
import {sendOTPEmail} from "../utils/mailer.js"
import { triggerAIUpdate } from "../utils/trackingUserBehavior.js";
import { Notification } from "../models/notification/notificationSchema.js"
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
      return res.status(400).json({
        error: "Username hoặc Email đã tồn tại",
      });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
      avatar: generateRandomAvatar(username),
      isVerified: false,
      otp,
      otpExpires
    });

    sendOTPEmail(email, otp).catch(err => console.error("Gửi mail ngầm thất bại:", err));

    await Notification.create({
      userId: newUser._id,
      title: "Chào mừng bạn mới!",
      body: `Chào mừng ${name} tới với Bếp Việt. Chúc bạn có những trải nghiệm tuyệt vời!`,
      type: 'SYSTEM_UPDATE',
      isRead: false
    });

    return res.status(201).json({
      code: 201,
      message: "Đăng ký thành công. Vui lòng kiểm tra email để nhận mã OTP.",
      data: {
        email: newUser.email,
        username: newUser.username,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp, type } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        if (String(user.otp) !== String(otp) || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn" });
        }

        if (!user.isVerified) {
            user.isVerified = true;
        }

        const isResetFlow = type === 'reset'; 
        
        if (!isResetFlow) {
            user.otp = undefined;
            user.otpExpires = undefined;
        }

        await user.save();

        res.status(200).json({ 
            message: "Xác thực thành công!",
            data: { email: user.email } 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Email không tồn tại" });
        }

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.otp = newOtp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        
        await user.save();

        sendOTPEmail(email, newOtp).catch(err => 
            console.error(`[Mail Error] Gửi lại OTP cho ${email} thất bại:`, err)
        );
        
        return res.status(200).json({ 
            code: 200,
            message: "Mã OTP mới đang được gửi. Vui lòng kiểm tra hộp thư của bạn." 
        });

    } catch (error) {
        console.error("Resend OTP error:", error);
        return res.status(500).json({ message: "Lỗi hệ thống khi gửi lại mã." });
    }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "Email không tồn tại trong hệ thống" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(otp);
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(email, otp); 

    return res.status(200).json({ message: "Mã OTP đặt lại mật khẩu đã được gửi" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
console.log(email);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }
    console.log("User otp: ",user.otp);
    console.log("Otp: ", otp);
    

    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({ error: "Mã OTP không chính xác" });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ error: "Mã OTP đã hết hạn" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(newPassword, salt);

    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    
    await user.save();

    return res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (err) {
    console.error("Lỗi reset password:", err);
    return res.status(500).json({ error: "Lỗi hệ thống, vui lòng thử lại sau" });
  }
};

export const login = async (req, res) => {
    try {
        const {username, password} = req.body
        const user = await User.findOne({
            $or: [
                {username: username},
                {email: username}
            ]
        })

        if(!user) {
            return res.status(200).json({error: "Username or email is not exits!"})
        }

        const isPasswordCorrect = await bcryptjs.compare(password, user.password || "")
        if(!isPasswordCorrect) {
            return res.status(400).json({error: "Invalid password"})
        }
        const token = generateTokenAndSetCookie(user, res)
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
              access_token: token
            }
        })
    } catch (error) {
        console.log(error.message)
        res.status(500).json({error: "Internal server"})
    }
}

export const logout = async (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 });
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