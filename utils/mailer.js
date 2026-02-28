import nodemailer from 'nodemailer';

export const sendOTPEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: "wnzdvelfwzahshku",
        },
    });
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Chưa cấu hình EMAIL_USER hoặc EMAIL_PASS trong .env");
    }
    const mailOptions = {
        from: `"App Hỗ Trợ" <${process.env.EMAIL_USER}>`,
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