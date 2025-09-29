require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const path = require("path");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Chat");
const mime = require("mime-types"); // ✅ correct package

const app = express();
app.use(express.json());

// ✅ Allow frontend requests
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"], // React & Flutter Dev
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    exposedHeaders: ["Content-Disposition"], // allow file headers
  })
);

// ✅ Serve uploaded KYC files with correct MIME type
app.use(
  "/uploads",
  (req, res, next) => {
    const type = mime.lookup(req.path); // ✅ works with mime-types
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
app.use("/api/chat", require("./routes/chatRoutes")); // ✅ Chat Routes
app.use("/api/brands", require("./routes/brandRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/products", require("./routes/productRoutes"));


app.get("/", (req, res) => res.send("API is running..."));

// ✅ Create server for sockets
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://192.168.40.161:5173", // ✅ LAN React app
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Socket.IO Chat Events
io.on("connection", (socket) => {
  console.log("⚡ A user connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId); // Each user joins their private room
    console.log(`✅ User ${userId} joined room`);
  });

  socket.on("send_message", async (data) => {
    try {
      const { sender, receiver, senderModel, receiverModel, message } = data;

      const newMessage = new Message({
        sender,
        receiver,
        senderModel,
        receiverModel,
        message,
      });
      await newMessage.save();

      io.to(receiver).emit("receive_message", newMessage);
    } catch (error) {
      console.error("Message error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
