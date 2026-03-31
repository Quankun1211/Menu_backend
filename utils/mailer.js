import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, 
    secure: true, 
    pool: true,  
    maxConnections: 5,
    maxMessages: 100,
    auth: {
        user: process.env.EMAIL_USER,
        pass: "wnzdvelfwzahshku", 
    },
    connectionTimeout: 20000, 
    greetingTimeout: 20000,
    socketTimeout: 30000,
});

transporter.verify((error, success) => {
    if (error) {
        console.error("❌ Lỗi kết nối Email (SMTP):", error);
    } else {
        console.log("✅ Server đã sẵn sàng gửi OTP");
    }
});

export const sendOTPEmail = async (email, otp) => {
    if (!process.env.EMAIL_USER) {
        throw new Error("Chưa cấu hình EMAIL_USER trong .env");
    }

    const mailOptions = {
        from: `"Bếp Việt" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Mã xác thực tài khoản (OTP)",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #4CAF50; text-align: center;">Xác thực Email</h2>
                <p>Chào bạn, mã OTP của bạn để kích hoạt tài khoản là:</p>
                <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; color: #333; letter-spacing: 5px;">
                    ${otp}
                </div>
                <p style="font-size: 12px; color: #777; margin-top: 20px;">Mã này có hiệu lực trong 10 phút. Nếu không phải bạn yêu cầu, vui lòng bỏ qua email này.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};