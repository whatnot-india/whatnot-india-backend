const mongoose = require("mongoose");

const orderProductSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId }, // ✅ which variant was ordered
  variantColor: { type: String }, // just for easy display
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
});

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  pincode: { type: String, required: true },
  fullAddress: { type: String, required: true },
});

const paymentInfoSchema = new mongoose.Schema({
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  status: {
    type: String,
    enum: ["CREATED", "PAID", "FAILED", "PENDING"],
    default: "CREATED",
  },
});

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    products: [orderProductSchema],
    address: addressSchema,

    paymentMethod: {
      type: String,
      enum: ["RAZORPAY", "COD"],
      required: true,
    },
    paymentInfo: paymentInfoSchema,

    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);