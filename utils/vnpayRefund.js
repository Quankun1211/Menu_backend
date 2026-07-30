import axios from 'axios';
import crypto from 'crypto';
import { format } from 'date-fns';

export const refundOrderLogic = async ({
  orderId,
  paymentRef,
  amount,
  transactionDate,
  transactionNo = "",
  user,
  ipAddress = "127.0.0.1",
}) => {
  try {
    const vnp_TmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnp_Api = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";

    const date = new Date();
    const vnp_RequestId = `${format(date, 'yyyyMMddHHmmss')}${crypto.randomBytes(6).toString('hex')}`;
    const vnp_Version = '2.1.0';
    const vnp_Command = 'refund';
    const vnp_TransactionType = '02'; 
    const vnp_Amount = amount * 100;
    const vnp_TxnRef = String(paymentRef || orderId);
    const vnp_OrderInfo = `Hoan tien don hang ${orderId}`;
    
    const vnp_TransactionDate = /^\d{14}$/.test(String(transactionDate))
      ? String(transactionDate)
      : format(new Date(transactionDate), 'yyyyMMddHHmmss');
    
    const vnp_CreateDate = format(date, 'yyyyMMddHHmmss');
    const vnp_CreateBy =
      String(user || "admin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32) || "admin";
    const vnp_IpAddr = ipAddress;

    const signData = [
      vnp_RequestId,
      vnp_Version,
      vnp_Command,
      vnp_TmnCode,
      vnp_TransactionType,
      vnp_TxnRef,
      vnp_Amount,
      transactionNo,
      vnp_TransactionDate,
      vnp_CreateBy,
      vnp_CreateDate,
      vnp_IpAddr,
      vnp_OrderInfo
    ].join('|');

    const hmac = crypto.createHmac("sha512", secretKey);
    const vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    const dataObj = {
      vnp_RequestId,
      vnp_Version,
      vnp_Command,
      vnp_TmnCode,
      vnp_TransactionType,
      vnp_TxnRef,
      vnp_Amount,
      vnp_TransactionNo: transactionNo,
      vnp_TransactionDate,
      vnp_CreateBy,
      vnp_CreateDate,
      vnp_IpAddr,
      vnp_OrderInfo,
      vnp_SecureHash
    };

    console.log(">>> Sending Refund Request to VNPAY...");
    const response = await axios.post(vnp_Api, dataObj);
    
    console.log(">>> VNPAY Refund Response:", response.data);
    return response.data;
    
  } catch (error) {
    console.error(">>> Refund Logic Error:", error.response?.data || error.message);
    throw new Error("Lỗi kết nối API hoàn tiền VNPAY");
  }
};
