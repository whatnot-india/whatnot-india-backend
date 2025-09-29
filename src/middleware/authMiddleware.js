const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Billing = require("../models/Billing");
const Customer = require("../models/Customer");

// Middleware: Verify JWT & attach user
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "Not authorized, no token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Look for user across Admin, Billing, Customer
    const user =
      (await Admin.findById(decoded.id).select("-password")) ||
      (await Billing.findById(decoded.id).select("-password")) ||
      (await Customer.findById(decoded.id).select("-password"));

    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Middleware: Allow only Admins
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "Admin") {
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied: Admins only" });
};

module.exports = { protect, adminOnly };
