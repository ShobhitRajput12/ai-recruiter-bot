const express = require("express");
const axios = require("axios");
const Candidate = require("../models/Candidate");

const router = express.Router();

router.post("/", async (req, res) => {
  try {

    const question = req.body.question;
    const groupName =
      typeof req.body.groupName === "string" ? req.body.groupName.trim() : "";
    console.log("Chat request received:", question);

    const candidates = await Candidate.find(groupName ? { groupName } : {});

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

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model,
        messages: [
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = response.data.choices[0].message.content;

    res.json({ answer });

  } catch (err) {
    console.error("Chat Error Details:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      apiKey: process.env.GROQ_API_KEY ? "SET" : "NOT SET"
    });
    res.status(500).json({ error: "Chatbot failed" });
  }
});

module.exports = router;
