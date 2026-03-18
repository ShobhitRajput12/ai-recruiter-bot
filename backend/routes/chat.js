const express = require("express");
const axios = require("axios");
const Candidate = require("../models/Candidate");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

router.post("/", async (req, res) => {
  try {

    const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
    const groupName =
      typeof req.body.groupName === "string" ? req.body.groupName.trim() : "";
    console.log("Chat request received:", question);

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    const filters = groupName
      ? { groupName, userId: req.user.id }
      : { userId: req.user.id };
    const candidates = await Candidate.find(filters);

    // Reduce prompt size by only sending the highest-scoring candidates and truncating resume text.
    const MAX_CANDIDATES = 5;
    const MAX_RESUME_CHARS = 400;

    const candidatesSummary = candidates
      .sort(
        (a, b) =>
          (b.finalScore || b.totalScore || b.score || 0) -
          (a.finalScore || a.totalScore || a.score || 0)
      )
      .slice(0, MAX_CANDIDATES)
      .map((c) => ({
        name: c.name,
        groupName: c.groupName || "",
        technicalScore: c.technicalScore ?? null,
        softwareSoftSkillsScore: c.softwareSoftSkillsScore ?? null,
        experienceMatch: c.experienceMatch ?? null,
        projectRelevance: c.projectRelevance ?? null,
        educationMatch: c.educationMatch ?? null,
        totalScore: c.finalScore ?? c.totalScore ?? c.score ?? null,
        remarks: c.remarks || "",
        resumeText: c.resumeText
          ? `${c.resumeText.slice(0, MAX_RESUME_CHARS)}${
              c.resumeText.length > MAX_RESUME_CHARS ? "...[truncated]" : ""
            }`
          : "",
      }));

    const prompt = `
You are an AI recruiter assistant.

Here are the top ${MAX_CANDIDATES} candidates (highest score first):
${JSON.stringify(candidatesSummary)}

Selected group:
${groupName || "All candidates"}

Recruiter question:
${question}

Answer naturally like a recruiter assistant.
`;

    const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      },
      {
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const answer =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!answer) {
      const finishReason = response.data?.candidates?.[0]?.finishReason;
      const promptFeedback = response.data?.promptFeedback;
      return res.status(502).json({
        error: "No answer received from Gemini.",
        details: {
          finishReason,
          promptFeedback
        }
      });
    }

    res.json({ answer });

  } catch (err) {
    console.error("Chat Error Details:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      apiKey: process.env.GEMINI_API_KEY ? "SET" : "NOT SET",
      model: process.env.GEMINI_MODEL || "gemini-3-flash-preview"
    });
    res.status(500).json({ error: "Chatbot failed" });
  }
});

module.exports = router;
