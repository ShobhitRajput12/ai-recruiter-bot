const express = require("express");
const multer = require("multer");
const parseFile = require("../utils/parser");
const scoreResume = require("../utils/aiScore");
const Candidate = require("../models/Candidate");

const router = express.Router();

// store files in memory
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.array("resumes"), async (req, res) => {
  try {

    const job = req.body.job;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No resumes uploaded" });
    }

    let results = [];

    for (const file of req.files) {

      console.log("Processing:", file.originalname);

      // 1️⃣ extract text from resume
      const text = await parseFile(file);

      // 2️⃣ AI score
      const aiResult = await scoreResume(text, job);

    const score = typeof aiResult === "number"
        ? aiResult
        : aiResult.score || 50;

      // 3️⃣ save to MongoDB
      const candidate = new Candidate({
        name: file.originalname,
        score: score,
        resumeText: text
      });

      await candidate.save();

      results.push(candidate);
    }

    res.json({
      message: "Resumes processed successfully",
      candidates: results
    });

  } catch (error) {

    console.error("Upload error:", error);

    res.status(500).json({
      message: "Error processing resumes"
    });

  }
});

module.exports = router;