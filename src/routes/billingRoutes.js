const express = require("express");
const router = express.Router();
const Billing = require("../models/Billing");

// Billing Registration
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const exists = await Billing.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already in use" });

    const billing = await Billing.create({ name, email, password });
    res.status(201).json({ message: "Billing registered successfully", id: billing._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
