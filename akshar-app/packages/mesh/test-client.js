import { io } from "socket.io-client";
import jwt from "jsonwebtoken";

console.log("Generating dummy JWT token...");
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production-minimum-32-chars!';
const token = jwt.sign({ sub: "test-user-456", sid: "session-1" }, jwtSecret);

console.log("Connecting to local Mesh Server...");
const socket = io("http://localhost:8003", {
  auth: { token }
});

const groupId = "test-group-123";
const userId = "test-user-456";

socket.on("connect", () => {
  console.log("✅ Connected! Socket ID:", socket.id);
  
  // Join the group
  socket.emit("join-room", { groupId });
  console.log(`Joined group: ${groupId}`);
  
  // Simulate sending an encrypted message with plaintext for AI
  console.log("\n🚀 Sending message to mesh...");
  socket.emit("send-message", {
    groupId,
    userId,
    ciphertext: { nonce: "mock", tag: "mock", val: "encrypted_mock" },
    plaintext: "Hello, this is a test message to see if the AI classifies it!",
    typingMs: 1500
  });
});

// Listen for the immediate broadcast
socket.on("new-message", (data) => {
  console.log("\n⚡ Received instant 'new-message' broadcast!");
  console.log("   - Message ID:", data.msgId);
  console.log("   - Initial AI Verdict:", data.classification?.verdict || "Unknown");
  console.log("   (Notice how this arrived instantly, without blocking!)");
});

// Listen for the asynchronous ML classification
socket.on("message-classified", (data) => {
  console.log("\n🧠 Received async 'message-classified' event!");
  console.log("   - Message ID:", data.msgId);
  console.log("   - Final AI Verdict:", data.classification?.verdict || "Unknown");
  console.log("\n✅ Async ML Integration is working flawlessly!");
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("Connection failed:", err.message);
  process.exit(1);
});

// Timeout fallback
setTimeout(() => {
  console.log("\n⏳ Test timed out (is the mesh server running?)");
  process.exit(1);
}, 10000);
