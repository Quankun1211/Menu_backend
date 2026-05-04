import crypto from 'crypto';
import { format } from 'date-fns';
function vnpayEncode(str) {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
export const createPaymentUrl = async ({ orderId, amount, ip, platform }) => {
  const tmnCode = process.env.VNP_TMN_CODE;
  const secretKey = process.env.VNP_HASH_SECRET;
  const vnpUrl = process.env.VNP_URL;
  
  let returnUrl = process.env.VNP_RETURN_URL;
  if (platform === 'web') {
    returnUrl = "http://localhost:5173/checkout/payment-check";
  }

  const date = new Date();
  const createDate = format(date, 'yyyyMMddHHmmss');

  let cleanIp = ip.includes('::ffff:') ? ip.replace('::ffff:', '') : (ip === '::1' ? '127.0.0.1' : ip);
  if (cleanIp === '127.0.0.1') cleanIp = '1.1.1.1';

  let vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId.toString(),
    vnp_OrderInfo: 'Thanh toan don hang ' + orderId,
    vnp_OrderType: 'other',
    vnp_Amount: Math.round(amount * 100),
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: cleanIp,
    vnp_CreateDate: createDate,
  };

const keys = Object.keys(vnp_Params).sort();

const queryParams = keys
  .map((key) => {
    return `${vnpayEncode(key)}=${vnpayEncode(String(vnp_Params[key]))}`;
  })
  .join('&');

const signData = queryParams;

const hmac = crypto.createHmac("sha512", secretKey);
const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

return `${vnpUrl}?${queryParams}&vnp_SecureHash=${signed}`;
};