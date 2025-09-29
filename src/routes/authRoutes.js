const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Billing = require("../models/Billing");
const Customer = require("../models/Customer");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Login for all roles
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let user =
      (await Admin.findOne({ email })) ||
      (await Billing.findOne({ email })) ||
      (await Customer.findOne({ email }));

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
