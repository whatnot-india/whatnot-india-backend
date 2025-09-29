const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "senderModel" },
    receiver: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "receiverModel" },
    senderModel: { type: String, required: true, enum: ["Admin", "Customer"] },
    receiverModel: { type: String, required: true, enum: ["Admin", "Customer"] },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);

