const express = require("express");
const Candidate = require("../models/Candidate");

const router = express.Router();

// Get all candidates (optionally sorted and limited)
router.get("/", async (req, res) => {
  try {
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    const limit = parseInt(req.query.limit, 10) || 0;

    const candidates = await Candidate.find()
      .sort({ [sortField]: sortOrder })
      .limit(limit);

    res.json(candidates);
  } catch (err) {
    console.error("Error fetching candidates:", err);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

// Get latest candidates (by upload date)
router.get("/latest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    const candidates = await Candidate.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(candidates);
  } catch (err) {
    console.error("Error fetching latest candidates:", err);
    res.status(500).json({ error: "Failed to fetch latest candidates" });
  }
});

// Get top candidates (by score)
router.get("/top", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    const candidates = await Candidate.find()
      .sort({ score: -1 })
      .limit(limit);

    res.json(candidates);
  } catch (err) {
    console.error("Error fetching top candidates:", err);
    res.status(500).json({ error: "Failed to fetch top candidates" });
  }
});

module.exports = router;
