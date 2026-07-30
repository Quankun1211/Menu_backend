import axios from "axios";
import crypto from "crypto";

const formatVnpayDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(date));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
};

const sign = (value) =>
  crypto
    .createHmac("sha512", process.env.VNP_HASH_SECRET)
    .update(Buffer.from(value, "utf-8"))
    .digest("hex");

const verifyResponse = (data) => {
  const signData = [
    data.vnp_ResponseId,
    data.vnp_Command,
    data.vnp_ResponseCode,
    data.vnp_Message,
    data.vnp_TmnCode,
    data.vnp_TxnRef,
    data.vnp_Amount,
    data.vnp_BankCode,
    data.vnp_PayDate,
    data.vnp_TransactionNo,
    data.vnp_TransactionType,
    data.vnp_TransactionStatus,
    data.vnp_OrderInfo,
    data.vnp_PromotionCode || "",
    data.vnp_PromotionAmount || "",
  ].join("|");
  const calculated = sign(signData);
  const receivedBuffer = Buffer.from(String(data.vnp_SecureHash || "").toLowerCase());
  const calculatedBuffer = Buffer.from(calculated.toLowerCase());
  return (
    receivedBuffer.length === calculatedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, calculatedBuffer)
  );
};

export const queryVnpayTransaction = async ({
  orderId,
  transactionDate,
  ipAddress = "127.0.0.1",
}) => {
  const now = new Date();
  const requestId = `${formatVnpayDate(now)}${crypto.randomBytes(6).toString("hex")}`;
  const payload = {
    vnp_RequestId: requestId,
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: process.env.VNP_TMN_CODE,
    vnp_TxnRef: String(orderId),
    vnp_OrderInfo: `Truy van don hang ${orderId}`,
    vnp_TransactionDate: /^\d{14}$/.test(String(transactionDate))
      ? String(transactionDate)
      : formatVnpayDate(transactionDate),
    vnp_CreateDate: formatVnpayDate(now),
    vnp_IpAddr: ipAddress,
  };
  payload.vnp_SecureHash = sign([
    payload.vnp_RequestId,
    payload.vnp_Version,
    payload.vnp_Command,
    payload.vnp_TmnCode,
    payload.vnp_TxnRef,
    payload.vnp_TransactionDate,
    payload.vnp_CreateDate,
    payload.vnp_IpAddr,
    payload.vnp_OrderInfo,
  ].join("|"));

  const response = await axios.post(
    "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    payload,
  );
  if (!verifyResponse(response.data)) {
    const error = new Error("Chữ ký phản hồi đối soát VNPay không hợp lệ");
    error.vnpayResponse = response.data;
    throw error;
  }
  return response.data;
};

export { formatVnpayDate };
