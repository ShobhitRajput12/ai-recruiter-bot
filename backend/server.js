const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const uploadRoute = require("./routes/upload");
const chatRoute = require("./routes/chat");
const candidatesRoute = require("./routes/candidates");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/upload", uploadRoute);
app.use("/chat", chatRoute);
app.use("/candidates", candidatesRoute);

app.get("/", (req, res) => {
  res.send("AI Recruiter Bot API Running");
});

const PORT = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.error(
    "ERROR: MONGO_URI environment variable is not set. Set it in backend/.env"
  );
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});