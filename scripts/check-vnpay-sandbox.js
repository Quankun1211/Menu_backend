const required = [
  "VNP_TMN_CODE",
  "VNP_HASH_SECRET",
  "VNP_URL",
];
const missing = required.filter((key) => !process.env[key]);
const returnUrl = process.env.VNP_RETURN_URL || process.env.VNPAY_RETURN_URL;
if (!returnUrl) missing.push("VNP_RETURN_URL hoặc VNPAY_RETURN_URL");
if (missing.length) {
  console.error(`Thiếu cấu hình VNPay sandbox: ${missing.join(", ")}`);
  process.exit(1);
}
const webReturnUrl =
  process.env.VNP_WEB_RETURN_URL ||
  `${process.env.FRONTEND_URL || "http://localhost:5173"}/checkout/payment-check`;
const ipnUrl = process.env.VNP_IPN_URL;
if (!/^https:\/\//.test(ipnUrl || "")) {
  console.warn("VNP_IPN_URL chưa dùng HTTPS công khai; VNPay không thể gửi IPN vào localhost trực tiếp.");
}
console.log(JSON.stringify({
  configured: true,
  tmnCode: `${process.env.VNP_TMN_CODE.slice(0, 2)}***`,
  gateway: process.env.VNP_URL,
  configuredReturnUrl: returnUrl,
  effectiveWebReturnUrl: webReturnUrl,
  ipnUrl,
  ipnCompatibilityPath: "/api/order/vnpay-ipn",
}, null, 2));
