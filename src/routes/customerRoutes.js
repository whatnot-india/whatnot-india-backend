const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");

// ---------------- CREATE ----------------
router.post("/register", async (req, res) => {
  const { name, email, password, mobile, state, city, pincode, address } = req.body;

  try {
    const exists = await Customer.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already in use" });

    const customer = await Customer.create({
      name,
      email,
      password,
      mobile,
      state,
      city,
      pincode,
      address,
    });

    res.status(201).json({
      message: "Customer registered successfully",
      id: customer._id,
      customer,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------------- READ ALL ----------------
router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------------- READ SINGLE ----------------
router.get("/:id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------------- UPDATE ----------------
router.put("/:id", async (req, res) => {
  try {
    const { name, email, mobile, state, city, pincode, address } = req.body;
    const customer = await Customer.findById(req.params.id);

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // Update fields if provided
    if (name) customer.name = name;
    if (email) customer.email = email;
    if (mobile) customer.mobile = mobile;
    if (state) customer.state = state;
    if (city) customer.city = city;
    if (pincode) customer.pincode = pincode;
    if (address) customer.address = address;

    await customer.save();

    res.json({ message: "Customer updated successfully", customer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------------- DELETE ----------------
router.delete("/:id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    await customer.deleteOne();
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
