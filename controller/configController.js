import { SystemSetting } from "../models/systemSettingModel.js";

export const getShippingFeeValue = async (session = null) => {
  const query = SystemSetting.findOne({ key: "shipping_fee" });
  if (session) query.session(session);
  const setting = await query.lean();
  const value = Number(setting?.value ?? 25000);
  return Number.isFinite(value) && value >= 0 ? value : 25000;
};

export const getShippingFee = async (_req, res) => {
  const shippingFee = await getShippingFeeValue();
  res.status(200).json({ success: true, data: { shippingFee } });
};

export const updateShippingFee = async (req, res) => {
  const shippingFee = Number(req.body?.shippingFee);
  if (!Number.isInteger(shippingFee) || shippingFee < 0 || shippingFee > 10_000_000) {
    return res.status(400).json({ success: false, message: "Phí vận chuyển không hợp lệ" });
  }
  const setting = await SystemSetting.findOneAndUpdate(
    { key: "shipping_fee" },
    {
      value: shippingFee,
      description: "Phí vận chuyển mặc định",
      updatedBy: req.user._id,
    },
    { upsert: true, new: true, runValidators: true },
  );
  res.status(200).json({ success: true, data: { shippingFee: Number(setting.value) } });
};
