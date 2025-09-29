// middleware/businessTypeMiddleware.js
const Kyc = require("../models/Kyc");

const attachBusinessType = async (req, res, next) => {
  if (req.user && req.user.role === "Customer") {
    try {
      const kyc = await Kyc.findOne({ customer: req.user._id, status: "APPROVED" });
      req.businessType = kyc ? kyc.businessType : null;
    } catch (error) {
      req.businessType = null;
    }
  }
  next();
};

module.exports = { attachBusinessType };
