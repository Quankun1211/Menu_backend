import { Notification } from "../models/notification/notificationSchema.js";

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

export const sendInternalNotification = async (userId, title, body, metadata = {}, ioInstance = null) => {
  try {
    // 1. Lưu DB trước
    const newNotification = await Notification.create({
      userId,
      title,
      body,
      metadata,
      isRead: false
    });

    const io = ioInstance || global._io;

    if (io) {
      // 2. Ép kiểu String tuyệt đối để khớp với Client emit
      const targetRoom = String(userId).trim();
      
      const socketsInRoom = io.sockets.adapter.rooms.get(targetRoom);
      const socketCount = socketsInRoom ? socketsInRoom.size : 0;
      
      console.log(`[SOCKET_DEBUG] Room: ${targetRoom} | Online Sockets: ${socketCount}`);

      // 3. Gửi thông báo
      io.to(targetRoom).emit("new_notification", newNotification);
      
      return newNotification;
    } else {
      console.log("[SOCKET_DEBUG] Không tìm thấy instance IO");
    }

    return newNotification;
  } catch (error) {
    console.error("Lỗi sendInternalNotification:", error);
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