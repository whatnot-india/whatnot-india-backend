const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { holdStock, unholdStock } = require("../utils/stockHelper");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ---------------- CREATE ORDER ----------------
router.post("/create-order", protect, async (req, res) => {
  try {
    const { products, address, paymentMethod } = req.body;

    if (!products?.length) {
      return res.status(400).json({ message: "No products in order" });
    }

    if (!["RAZORPAY", "COD"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    let totalAmount = 0;

    const productDetails = await Promise.all(
      products.map(async (item) => {
        const product = await Product.findById(item.product);
        if (!product) throw new Error("Product not found");

        let unitPrice;
        let variantColor = null;
        let variantId = null;

        if (item.variantId) {
          const variant = product.variants.id(item.variantId);
          if (!variant) throw new Error("Variant not found");
          unitPrice = Number(variant.price || product.offerPrice || product.originalPrice);
          variantColor = variant.color;
          variantId = variant._id;
        } else {
          unitPrice = Number(product.offerPrice || product.originalPrice);
        }

        const totalPrice = unitPrice * item.quantity;
        totalAmount += totalPrice;

        return {
          product: product._id,
          variantId,
          variantColor,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        };
      })
    );

    // ✅ Hold stock
    await holdStock(productDetails);

    const orderData = {
      customer: req.user._id,
      products: productDetails,
      address,
      totalAmount,
      paymentMethod,
      status: paymentMethod === "COD" ? "CONFIRMED" : "PENDING", // ✅ Auto confirm COD
      paymentInfo: paymentMethod === "COD" ? { status: "PENDING" } : {},
    };

    if (paymentMethod === "RAZORPAY") {
      const options = {
        amount: totalAmount * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}`
      };

      const razorpayOrder = await razorpay.orders.create(options);
      orderData.paymentInfo = { razorpayOrderId: razorpayOrder.id, status: "CREATED" };

      const order = new Order(orderData);
      await order.save();

      setTimeout(async () => {
        const checkOrder = await Order.findById(order._id);
        if (checkOrder && checkOrder.paymentInfo.status === "CREATED") {
          await unholdStock(checkOrder.products);
          checkOrder.status = "CANCELLED";
          checkOrder.paymentInfo.status = "FAILED";
          await checkOrder.save();
        }
      }, 10 * 60 * 1000);

      return res.status(201).json({
        message: "Razorpay order created",
        order,
        razorpayOrder
      });
    } else {
      // ✅ COD — already CONFIRMED
      const order = new Order(orderData);
      await order.save();
      return res.status(201).json({ message: "COD order placed & confirmed", order });
    }
  } catch (error) {
    console.error(error);
    if (req.body.products) await unholdStock(req.body.products);
    res.status(500).json({ message: error.message });
  }
});

// ---------------- VERIFY PAYMENT ----------------
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const order = await Order.findOne({ "paymentInfo.razorpayOrderId": razorpayOrderId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.paymentInfo = {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: "PAID"
    };
    order.status = "CONFIRMED";
    await order.save();

    res.json({ message: "Payment verified & order confirmed", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// ---------------- GET ALL ORDERS (Customer & Admin) ----------------
router.get("/", protect, async (req, res) => {
  try {
    let query = {};

    if (req.user.role !== "admin") {
      // 👤 Normal user — only their orders
      query = { customer: req.user._id };
    }

    const orders = await Order.find(query)
      .populate("customer", "name email mobile")
      .populate("products.product", "name images offerPrice originalPrice")
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------------- GET SINGLE ORDER BY ID ----------------
router.get("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name email mobile")
      .populate("products.product", "name images offerPrice originalPrice");

    if (!order) return res.status(404).json({ message: "Order not found" });

    // 🔐 Restrict access to customer’s own order if not admin
    if (req.user.role !== "admin" && order.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
