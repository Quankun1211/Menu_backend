import emailjs from "@emailjs/nodejs";

const requiredEmailJsVariables = [
  "EMAILJS_SERVICE_ID",
  "EMAILJS_TEMPLATE_ID",
  "EMAILJS_PUBLIC_KEY",
  "EMAILJS_PRIVATE_KEY",
];

const isUsableSecret = (value) =>
  typeof value === "string" &&
  value.trim().length > 8 &&
  !/[•*]{3,}/u.test(value) &&
  !/^(replace|your_|changeme)/i.test(value.trim());

export const validateEmailConfiguration = () => {
  const missing = requiredEmailJsVariables.filter(
    (name) => !isUsableSecret(process.env[name]),
  );
  if (missing.length) {
    const error = new Error(`Email service is not configured: ${missing.join(", ")}`);
    error.code = "EMAIL_CONFIGURATION_ERROR";
    throw error;
  }
};

export const sendOTPEmail = async (email, otp) => {
  validateEmailConfiguration();

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const templateParams = {
    otp_code: otp,
    expiry_time: expiresAt.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    email,
    user_name: email.split("@")[0],
  };

  try {
    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      },
    );
  } catch (cause) {
    const error = new Error("Không thể gửi email OTP");
    error.code = "EMAIL_DELIVERY_ERROR";
    error.cause = cause;
    throw error;
  }
};
