import { User } from "../models/userModel.js";
import { Address } from "../models/addressModel.js";

export const addAddress = async (req, res) => {
    try {
      const userId = req.user.id;
      const { name, phone, address, isDefault } = req.body;
  
      if (!name || !phone || !address) {
        return res.status(400).json({
          code: 400,
          message: "Thiếu thông tin địa chỉ",
        });
      }
  
      const count = await Address.countDocuments({ userId });
  
      let finalIsDefault = isDefault ?? false;
  
      if (count === 0) {
        finalIsDefault = true;
      }
  
      if (finalIsDefault) {
        await Address.updateMany(
          { userId },
          { $set: { isDefault: false } }
        );
      }
  
      const newAddress = await Address.create({
        userId,
        name,
        phone,
        address,
        isDefault: finalIsDefault,
      });
  
      return res.status(200).json({
        code: 200,
        message: "Thêm địa chỉ thành công",
        data: newAddress,
      });
    } catch (error) {
      console.error("addAddress error:", error);
      return res.status(500).json({ code: 500 });
    }
  };

export const getAddresses = async (req, res) => {
    try {
      const userId = req.user.id;
  
      const addresses = await Address.find({ userId })
        .sort({ isDefault: -1, createdAt: -1 });
  
      return res.status(200).json({
        code: 200,
        data: addresses,
      });
    } catch (error) {
      console.error("getAddresses error:", error);
      return res.status(500).json({ code: 500 });
    }
};
export const getAddressById = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { addressId } = req.params;

    const address = await Address.findOne({
      _id: addressId,
      userId,
    });

    if (!address) {
      return res.status(404).json({
        code: 404,
        message: "Không tìm thấy địa chỉ",
      });
    }

    return res.status(200).json({
      code: 200,
      data: address,
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      message: "Lỗi server",
    });
  }
};
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;
    const { name, phone, address, isDefault } = req.body;

    if (isDefault === true) {
      await Address.updateMany(
        { userId },
        { isDefault: false }
      );
    }

    const updated = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      {
        name,
        phone,
        address,
        ...(typeof isDefault === "boolean" && { isDefault }),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        code: 404,
        message: "Không tìm thấy địa chỉ",
      });
    }

    return res.status(200).json({
      code: 200,
      message: "Cập nhật địa chỉ thành công",
      data: updated,
    });
  } catch (error) {
    console.error("updateAddress error:", error);
    return res.status(500).json({
      code: 500,
      message: "Lỗi server",
    });
  }
};

  
export const setDefaultAddress = async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;
  
      const address = await Address.findOne({ _id: addressId, userId });
  
      if (!address) {
        return res.status(404).json({
          code: 404,
          message: "Không tìm thấy địa chỉ",
        });
      }
  
      await Address.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
  
      address.isDefault = true;
      await address.save();
  
      return res.status(200).json({
        code: 200,
        message: "Đã đặt địa chỉ mặc định",
      });
    } catch (error) {
      console.error("setDefaultAddress error:", error);
      return res.status(500).json({ code: 500 });
    }
  };
  
  export const deleteAddress = async (req, res) => {
    try {
      const userId = req.user.id;
      const { addressId } = req.params;
  
      const address = await Address.findOne({ _id: addressId, userId });
      if (!address) {
        return res.status(404).json({ code: 404 });
      }
  
      const wasDefault = address.isDefault;
  
      await address.deleteOne();
  
      if (wasDefault) {
        const latest = await Address.findOne({ userId })
          .sort({ createdAt: -1 });
  
        if (latest) {
          latest.isDefault = true;
          await latest.save();
        }
      }
  
      return res.status(200).json({
        code: 200,
        message: "Xóa địa chỉ thành công",
      });
    } catch (error) {
      console.error("deleteAddress error:", error);
      return res.status(500).json({ code: 500 });
    }
  };
  