const mongoose = require("mongoose");

const businessTypes = {
  PVT_LTD: ["PAN", "GST", "CANCELLED_CHEQUE", "MOA", "AOA", "COI"],
  LLP: ["PAN", "GST", "CANCELLED_CHEQUE", "PARTNERSHIP_DEED"],
  SOLE_PROPRIETORSHIP: ["PAN", "GST", "CANCELLED_CHEQUE", "KYC"],
};

const kycSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    businessType: {
      type: String,
      enum: Object.keys(businessTypes),
      required: true,
    },
    documents: {
      type: Map,
      of: String, // store file URL or path
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Kyc", kycSchema);
module.exports.businessTypes = businessTypes;
