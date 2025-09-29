const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Message = require("../models/Chat");


// Admin: get all conversations
router.get("/conversations/:adminId", async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({ message: "Invalid adminId" });
    }

    const adminObjId = new mongoose.Types.ObjectId(adminId);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ receiver: adminObjId }, { sender: adminObjId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", adminObjId] },
              "$receiver",
              "$sender",
            ],
          },
          lastMessage: { $first: "$message" },
          lastTime: { $first: "$createdAt" },
        },
      },
      // 👇 Join with Customer collection
      {
        $lookup: {
          from: "customers",            // collection name in MongoDB
          localField: "_id",            // customer _id
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          lastTime: 1,
          "userInfo.name": 1,
          "userInfo.email": 1,
        },
      },
    ]);

    res.json(conversations);
  } catch (error) {
    console.error("Conversations error:", error);
    res.status(500).json({ message: error.message });
  }
});


// Get chat history between a user and admin
router.get("/:userId/:adminId", async (req, res) => {
  try {
    const { userId, adminId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: adminId },
        { sender: adminId, receiver: userId },
      ],
    }).sort({ createdAt: 1 }); // oldest first
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Send message (testing without socket)
router.post("/send", async (req, res) => {
  try {
    const { sender, receiver, senderModel, receiverModel, message } = req.body;

    if (!sender || !receiver || !senderModel || !receiverModel || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newMessage = await Message.create({
      sender,
      receiver,
      senderModel,
      receiverModel,
      message,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;
