import "dotenv/config";
import mongoose from "mongoose";
import connect from "./db/connectDb.js";
import { Order } from "./models/ordersModel.js";
import { Address } from "./models/addressModel.js";

const apply = process.argv.includes("--apply");

const run = async () => {
  await connect();
  const orders = await Order.find({
    $or: [
      { "deliveryAddress.address": { $exists: false } },
      { statusHistory: { $size: 0 } },
    ],
  });
  let snapshots = 0;
  let histories = 0;

  for (const order of orders) {
    if (!order.deliveryAddress?.address && order.address) {
      const address = await Address.findById(order.address).lean();
      if (address) {
        order.deliveryAddress = {
          name: address.name,
          phone: address.phone,
          address: address.address,
          province: address.province,
          district: address.district,
          ward: address.ward,
          latitude: address.latitude,
          longitude: address.longitude,
        };
        snapshots += 1;
      }
    }
    if (!order.statusHistory?.length) {
      order.statusHistory = [{
        status: order.status,
        at: order.updatedAt || order.createdAt || new Date(),
        actorRole: "system",
        note: "Khởi tạo lịch sử từ dữ liệu hiện có",
      }];
      histories += 1;
    }
    if (apply) await order.save({ validateModifiedOnly: true });
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    matchedOrders: orders.length,
    addressSnapshots: snapshots,
    statusHistories: histories,
  }, null, 2));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
