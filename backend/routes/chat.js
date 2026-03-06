const express = require("express");
const axios = require("axios");
const Candidate = require("../models/Candidate");

const router = express.Router();

router.post("/", async (req, res) => {
  try {

    const question = req.body.question;
    console.log("Chat request received:", question);

    const candidates = await Candidate.find();

    const prompt = `
You are an AI recruiter assistant.

Candidates database:
${JSON.stringify(candidates)}

Recruiter question:
${question}

Answer naturally like a recruiter assistant.
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
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