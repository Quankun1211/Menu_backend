import emailjs from '@emailjs/nodejs';

export const sendOTPEmail = async (email, otp) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const templateParams = {
        otp_code: otp,           // Khớp với {{otp_code}}
        expiry_time: timeString, // Khớp với {{expiry_time}}
        email: email,         // Sử dụng biến này trong ô "To Email" của EmailJS Settings
        user_name: email.split('@')[0] // Tùy chọn nếu muốn hiện tên user
    };

    try {
        await emailjs.send(
            process.env.EMAILJS_SERVICE_ID,
            process.env.EMAILJS_TEMPLATE_ID,
            templateParams,
            {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY,
            }
        );
        console.log("✅ OTP đã gửi thành công tới:", email);
    } catch (error) {
        console.error("❌ Lỗi gửi OTP qua EmailJS:", error);
    }
};