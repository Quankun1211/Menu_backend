import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { Product } from "../models/productsModel.js";

test("concurrent reservations never make stock negative", {
  skip: !process.env.TEST_MONGODB_URI && "Set TEST_MONGODB_URI to run MongoDB integration tests",
}, async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI);
  const product = await Product.create({
    name: `Concurrency ${Date.now()}`,
    price: 10000,
    unit: "kg",
    description: "integration test",
    images: "https://example.com/test.jpg",
    stock: 1,
    slug: `concurrency-${Date.now()}`,
    region: "nam",
    origin: "test",
  });
  try {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        Product.updateOne(
          { _id: product._id, stock: { $gte: 1 } },
          { $inc: { stock: -1 } },
        ),
      ),
    );
    assert.equal(results.reduce((sum, item) => sum + item.modifiedCount, 0), 1);
    assert.equal((await Product.findById(product._id)).stock, 0);
  } finally {
    await Product.deleteOne({ _id: product._id });
    await mongoose.disconnect();
  }
});
