const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, // final price charged
      },
    ],

    address: {
      name: { type: String, required: true },
      mobile: { type: String, required: true },
      state: { type: String, required: true },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
      fullAddress: { type: String, required: true },
    },

    paymentInfo: {
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
      status: { type: String, enum: ["CREATED", "PAID", "FAILED"], default: "CREATED" },
    },

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
