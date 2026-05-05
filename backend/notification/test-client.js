/**
 * Simple Socket.IO Test Client
 * Run this to verify real-time data is flowing from the notification service.
 * Usage: node test-client.js
 */
const { io } = require("socket.io-client");

// Connect to Kong (which proxies to the notification service)
const socket = io("http://localhost:8000", {
  path: "/ws",
  transports: ["websocket"]
});

console.log("Connecting to SWMS Real-time Stream...");

socket.on("connect", () => {
  console.log("✅ Connected! Socket ID:", socket.id);
  
  // Join the 'dashboard-all' room to see everything
  // In the real dashboard, we'd join specific zone rooms too
  socket.emit("join", "dashboard-all");
  console.log("Joined room: dashboard-all. Waiting for events...");
});

socket.on("bin:update", (data) => {
  console.log("\n[BIN UPDATE]", data.bin_id);
  console.log(`  Zone: ${data.zone_name} | Cluster: ${data.cluster_name}`);
  console.log(`  Fill Level: ${data.fill_level_pct}% | Status: ${data.status}`);
  console.log(`  Weight: ${data.estimated_weight_kg}kg | Category: ${data.waste_category}`);
});

socket.on("zone:stats", (data) => {
  console.log("\n[ZONE STATS]", data.zone_name);
  console.log(`  Avg Fill: ${data.avg_fill_level_pct}% | Urgent: ${data.urgent_bin_count}`);
});

socket.on("alert:urgent", (data) => {
  console.log("\n🚨 [URGENT ALERT]", data.message);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.log("⚠️ Connection Error:", error.message);
});
