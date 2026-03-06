const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Load environment variables from backend/.env when running locally
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const uploadRoute = require("./routes/upload");
const chatRoute = require("./routes/chat");
const Candidate = require("./models/Candidate");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/upload", uploadRoute);
app.use("/chat", chatRoute);

app.get("/candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find();
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

app.get("/candidates/latest", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 }).limit(10);
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch latest candidates" });
  }
});

app.get("/candidates/top", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ score: -1 }).limit(10);
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch top candidates" });
  }
});

const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.error(
    "ERROR: MONGO_URI environment variable is not set.\nMake sure to set MONGO_URI in your deployment environment or in backend/.env for local dev."
  );
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});