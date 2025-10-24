const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    pdfUrl: {
      type: String,
      required: true, // Path or Cloud URL of the uploaded PDF
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin", // or "User" depending on your user model
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ledger", ledgerSchema);
