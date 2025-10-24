const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");
const Billing = require("../models/Billing");
const Customer = require("../models/Customer");
const Kyc = require("../models/Kyc"); // ✅ Added for KYC check

// 🔐 Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// 🧭 LOGIN for Admin / Billing / Customer
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let user =
      (await Admin.findOne({ email })) ||
      (await Billing.findOne({ email })) ||
      (await Customer.findOne({ email }));

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    let responseData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    };

    // ✅ If Customer, include KYC status
    if (user.role === "Customer") {
      const kyc = await Kyc.findOne({ customer: user._id });

      let kycStatus = "NOT_UPLOADED";
      if (kyc) {
        kycStatus = kyc.status || "PENDING";
      }

      responseData.kycStatus = kycStatus;

      console.log("👤 Customer login:", {
  email: user.email,
  kycStatus: kyc ? kyc.status : "NOT_UPLOADED",
  kycId: kyc?._id,
});

    }

    res.json(responseData);
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: error.message });
  }
});


// 🔐 Forgot Password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Check in all three collections
    let user =
      (await Admin.findOne({ email })) ||
      (await Billing.findOne({ email })) ||
      (await Customer.findOne({ email }));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new random password
    const newPassword = Math.random().toString(36).slice(-8);

    // ✅ Assign plain text and let the pre-save hook hash it
    user.password = newPassword;
    await user.save();

    console.log("🔑 Saved new password for", user.email, newPassword);

    // Send new password via email
    await sendEmail(
      user.email,
      "Password Reset - MyApp",
      `Hello ${user.name},\n\nYour new password is: ${newPassword}\n\nPlease login and change it immediately.`
    );

    res.json({ message: "New password sent to your email" });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;