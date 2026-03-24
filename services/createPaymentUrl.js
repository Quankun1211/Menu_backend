import crypto from 'crypto';
import { format } from 'date-fns';

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
  const sortedParams = {};
  keys.forEach(key => {
    sortedParams[key] = vnp_Params[key];
  });

  const signData = keys
    .map((key) => {
      const value = String(sortedParams[key]);
      return `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%20/g, '+')}`;
    })
    .join('&');

  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

  const finalUrlParams = keys
    .map((key) => {
      const value = String(sortedParams[key]);
      return `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%20/g, '+')}`;
    })
    .join('&');

  return `${vnpUrl}?${finalUrlParams}&vnp_SecureHash=${signed}`;
};