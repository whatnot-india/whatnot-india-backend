const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

// ✅ Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ------------------ CREATE RAZORPAY ORDER ------------------
router.post("/create-order", protect, async (req, res) => {
  try {
    const { products, address } = req.body;
    if (!products || products.length === 0) {
      return res.status(400).json({ message: "No products in order" });
    }

    // calculate total
    let totalAmount = 0;
    const productDetails = await Promise.all(
      products.map(async (item) => {
        const product = await Product.findById(item.product);
        if (!product) throw new Error("Product not found: " + item.product);
        const price = product.offerPrice || product.originalPrice;
        totalAmount += price * item.quantity;
        return { product: product._id, quantity: item.quantity, price };
      })
    );

    // create razorpay order
    const options = {
      amount: totalAmount * 100, // in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // temp order entry
    const order = new Order({
      customer: req.user._id,
      products: productDetails,
      address,
      totalAmount,
      paymentInfo: { razorpayOrderId: razorpayOrder.id, status: "CREATED" },
    });

    await order.save();

    res.json({ order, razorpayOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------ VERIFY PAYMENT ------------------
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const order = await Order.findOne({ "paymentInfo.razorpayOrderId": razorpayOrderId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.paymentInfo = { razorpayOrderId, razorpayPaymentId, razorpaySignature, status: "PAID" };
    order.status = "CONFIRMED";
    await order.save();

    res.json({ message: "Payment verified & order confirmed", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------ CUSTOMER ORDERS ------------------
router.get("/my-orders", protect, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate("products.product", "name images")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------ ADMIN: ALL ORDERS ------------------
router.get("/", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customer", "name email mobile")
      .populate("products.product", "name images")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------ ADMIN: UPDATE STATUS ------------------
router.put("/:id/status", protect, authorizeRoles("Admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    await order.save();

    res.json({ message: "Order status updated", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
