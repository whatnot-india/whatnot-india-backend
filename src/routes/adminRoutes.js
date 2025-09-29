const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");

// Admin Registration
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already in use" });

    const admin = await Admin.create({ name, email, password });
    res.status(201).json({ message: "Admin registered successfully", id: admin._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
