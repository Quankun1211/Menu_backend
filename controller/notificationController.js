import { Notification } from "../models/notification/notificationSchema.js";
import { User } from "../models/userModel.js"
import admin from "firebase-admin";

export const getNotification = async (req, res) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) return res.status(200).json({ notifications: [], unreadCount: 0 });

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return res.status(201).json({
        success: true,
        data:  notifications ,
        unreadCount: unreadCount
      });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy thông báo", error: error.message });
  }
};
export const readAllNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện thao tác này",
      });
    }

    const result = await Notification.updateMany(
      { 
        userId: userId, 
        isRead: false 
      },
      { 
        $set: { isRead: true } 
      }
    );

    return res.status(200).json({
      success: true,
      message: `Đã đánh dấu ${result.modifiedCount} thông báo là đã đọc`,
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật thông báo",
      error: error.message,
    });
  }
};
export const readNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) return res.status(404).json({ message: "Không tìm thấy" });

    res.status(200).json({ message: "Đã đọc", notification });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

export const sendInternalNotification = async (userId, title, body, metadata = {}, image = null, ioInstance = null) => {
  try {
    const newNotification = await Notification.create({
      userId,
      title,
      body,
      image, 
      metadata,
      isRead: false
    });

    const io = ioInstance || global._io;

    if (io) {
      const targetRoom = String(userId).trim();
      
      const socketsInRoom = io.sockets.adapter.rooms.get(targetRoom);
      const socketCount = socketsInRoom ? socketsInRoom.size : 0;
      
      console.log(`[SOCKET_DEBUG] Room: ${targetRoom} | Online Sockets: ${socketCount}`);

      io.to(targetRoom).emit("new_notification", newNotification);
      
      return newNotification;
    } else {
      console.log("[SOCKET_DEBUG] Không tìm thấy instance IO");
    }

    if (userId) {
      const user = await User.findById(userId).select("pushToken")

      if (user && user.pushToken) {
        const stringifiedMetadata = Object.fromEntries(
          Object.entries(metadata || {}).map(([key, value]) => [key, String(value)])
        )

        const fcmMessage = {
          token: user.pushToken,
          notification: {
            title,
            body,
            ...(image ? { imageUrl: image } : {})
          },
          data: {
            ...stringifiedMetadata,
            notificationId: newNotification._id.toString()
          }
        }

        admin.messaging().send(fcmMessage)
          .then((res) => console.log("Đẩy thông báo thành công: ", res))
          .catch((err) => console.error("Lỗi khi đẩy thông báo: ", err.message))
      }
    }

    return newNotification;
  } catch (error) {
    console.error("Lỗi sendInternalNotification:", error);
    throw error;
  }
};

export const createNotificationFromApi = async (req, res) => {
  try {
    const { userId, title, body, metadata } = req.body;

    const notification = await sendInternalNotification(userId, title, body, metadata);

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi API", error: error.message });
  }
};