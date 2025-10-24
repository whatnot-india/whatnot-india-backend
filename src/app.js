require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const path = require("path");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mime = require("mime-types");
const Message = require("./models/Chat");

const app = express();
app.use(express.json());

// ✅ CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://192.168.40.161:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  })
);

// ✅ Serve uploads with MIME type
app.use(
  "/uploads",
  (req, res, next) => {
    const type = mime.lookup(req.path);
    if (type) res.type(type);
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

// ✅ DB Connect
connectDB();

// ✅ Routes
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/customer", require("./routes/customerRoutes"));
app.use("/api/billing", require("./routes/billingRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/kyc", require("./routes/kycRoutes"));
app.use("/api/banners", require("./routes/bannerRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/brands", require("./routes/brandRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/ledgers", require("./routes/ledgerRoutes"));

app.get("/", (req, res) => res.send("✅ API is running..."));

// ✅ HTTP Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://192.168.40.161:5173",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// 🧠 Track active users
const activeUsers = new Map();

io.on("connection", (socket) => {
  console.log(`⚡ User connected: ${socket.id}`);

  socket.on("join", (userId) => {
    if (userId) {
      activeUsers.set(userId, socket.id);
      socket.join(userId);
      console.log(`✅ User ${userId} joined their room`);
      io.emit("active_users", Array.from(activeUsers.keys()));
    }
  });

  // 📩 Send message
  socket.on("send_message", async (data) => {
    try {
      const { sender, receiver, senderModel, receiverModel, message } = data;
      if (!sender || !receiver || !message) return;

      const newMessage = await Message.create({
        sender,
        receiver,
        senderModel,
        receiverModel,
        message,
      });

      // 👉 send to receiver if online
      const receiverSocket = activeUsers.get(receiver);
      if (receiverSocket) io.to(receiverSocket).emit("receive_message", newMessage);

      // 👉 send to sender to confirm
      io.to(socket.id).emit("message_sent", newMessage);
    } catch (err) {
      console.error("❌ Message error:", err);
    }
  });

  // 👀 Mark messages as read
  socket.on("mark_read", async (data) => {
    try {
      const { userId, otherUserId } = data;
      await Message.updateMany(
        { sender: otherUserId, receiver: userId, read: false },
        { $set: { read: true } }
      );

      // notify sender of read receipts
      const senderSocket = activeUsers.get(otherUserId);
      if (senderSocket) {
        io.to(senderSocket).emit("messages_read", {
          readerId: userId,
          senderId: otherUserId,
        });
      }
    } catch (err) {
      console.error("❌ Mark read error:", err);
    }
  });

  // ❌ Disconnect
  socket.on("disconnect", () => {
    for (const [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        activeUsers.delete(userId);
        console.log(`❌ User ${userId} disconnected`);
        io.emit("active_users", Array.from(activeUsers.keys()));
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
