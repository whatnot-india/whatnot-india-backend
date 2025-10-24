const mongoose = require("mongoose");

// ✅ Now all business types use SAME required docs
const businessTypes = {
  PVT_LTD: ["PAN", "AADHAR", "GST", "CANCELLED_CHEQUE"],
  LLP: ["PAN", "AADHAR", "GST", "CANCELLED_CHEQUE"],
  SOLE_PROPRIETORSHIP: ["PAN", "AADHAR", "GST", "CANCELLED_CHEQUE"],
  PARTNERSHIP: ["PAN", "AADHAR", "GST", "CANCELLED_CHEQUE"],
};

// Partner sub-schema
const partnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  documents: {
    PAN: String,
    AADHAR: String,
    GST: String,
    CANCELLED_CHEQUE: String,
  },
});

const kycSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    businessType: {
      type: String,
      enum: Object.keys(businessTypes),
      required: true,
    },
    // For normal business types
    documents: {
      type: Map,
      of: String,
    },
    // For partnership firm (multiple partners)
    partners: [partnerSchema],
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
