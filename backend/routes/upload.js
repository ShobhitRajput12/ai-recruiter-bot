const express = require("express");
const multer = require("multer");
const extractText = require("../utils/extractText");
const scoreResume = require("../utils/aiScore");
const {
  generateCandidateRemarks,
  normalizeCategoryWeights,
  getCategoryWeightTotal
} = require("../utils/aiScore");
const Candidate = require("../models/Candidate");
const { extractCandidateNameFromResume } = require("../utils/candidateName");
const authMiddleware = require("../middleware/auth");
const {
  CURRENT_SCORING_VERSION,
  normalizeApiScore,
  scaleValidatedScoresForStorage
} = require("../utils/scoreScale");

const router = express.Router();

router.use(authMiddleware);

function toApiCandidate(candidate) {
  const plainCandidate = candidate.toObject ? candidate.toObject() : candidate;
  const finalScore = plainCandidate.finalScore ?? plainCandidate.totalScore ?? plainCandidate.score ?? null;

  return {
    ...plainCandidate,
    technical_skills_score: normalizeApiScore(
      plainCandidate.technicalScore,
      plainCandidate.scoringVersion
    ),
    software_soft_skills_score: normalizeApiScore(
      plainCandidate.softwareSoftSkillsScore,
      plainCandidate.scoringVersion
    ),
    experience_score: normalizeApiScore(
      plainCandidate.experienceMatch,
      plainCandidate.scoringVersion
    ),
    projects_score: normalizeApiScore(
      plainCandidate.projectRelevance,
      plainCandidate.scoringVersion
    ),
    education_certification_score: normalizeApiScore(
      plainCandidate.educationMatch,
      plainCandidate.scoringVersion
    ),
    final_score: normalizeApiScore(finalScore, plainCandidate.scoringVersion),
    match_percentage: normalizeApiScore(
      plainCandidate.matchPercentage ?? finalScore,
      plainCandidate.scoringVersion
    )
  };
}

// memory storage
const storage = multer.memoryStorage();

// allowed file types
const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg"
];

// multer config
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Only PDF, DOC, DOCX, PNG, JPG, JPEG allowed."));
    }

  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});


// upload route
router.post("/", upload.array("resumes"), async (req, res) => {

  try {

    const job = typeof req.body.job === "string" ? req.body.job.trim() : "";
    const groupName =
      typeof req.body.groupName === "string" ? req.body.groupName.trim() : "";
    let scoringWeights = normalizeCategoryWeights();

    if (typeof req.body.weights === "string" && req.body.weights.trim()) {
      try {
        scoringWeights = normalizeCategoryWeights(JSON.parse(req.body.weights));
      } catch (parseError) {
        return res.status(400).json({
          message: "Invalid scoring weights payload"
        });
      }
    }

    if (getCategoryWeightTotal(scoringWeights) !== 100) {
      return res.status(400).json({
        message: "Scoring weights must add up to 10"
      });
    }

    // validate job description
    if (!job) {
      return res.status(400).json({
        message: "Job description is required"
      });
    }

    // validate files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No resumes uploaded"
      });
    }

    const results = [];
    const failedFiles = [];

    for (const file of req.files) {
      try {

        console.log("Processing:", file.originalname);

        // extract resume text
        let text = "";

        try {
          text = await extractText(file);
        } catch (parseError) {
          console.error("Parse error:", parseError);
        }

        if (!text || text.trim().length === 0) {
          console.warn("No text extracted from:", file.originalname);
          text = "Unable to extract resume text";
        }

        const displayName = extractCandidateNameFromResume(text, file.originalname, {
          mimeType: file.mimetype
        });

        let aiResult;

        try {
          aiResult = await scoreResume(text, job, scoringWeights);
        } catch (aiError) {
          console.error("AI scoring failed:", aiError);
          aiResult = {
            technicalScore: null,
            softwareSoftSkillsScore: null,
            experienceMatch: null,
            projectRelevance: null,
            educationMatch: null,
            totalScore: null,
            finalScore: null,
            match_percentage: null
          };
        }

      const technicalScore = aiResult?.technicalScore;
      const softwareSoftSkillsScore = aiResult?.softwareSoftSkillsScore;
      const experienceMatch = aiResult?.experienceMatch;
      const projectRelevance = aiResult?.projectRelevance;
      const educationMatch = aiResult?.educationMatch;
      const totalScore = aiResult?.totalScore ?? aiResult?.finalScore;

        if (
          technicalScore !== null &&
          typeof technicalScore !== "number"
        ) {
          throw new Error("Invalid technical score");
        }

      if (
        softwareSoftSkillsScore !== null &&
        typeof softwareSoftSkillsScore !== "number"
      ) {
          throw new Error("Invalid software / soft skills score");
      }

      if (
        experienceMatch !== null &&
        typeof experienceMatch !== "number"
      ) {
          throw new Error("Invalid experience match score");
      }

      if (
        projectRelevance !== null &&
        typeof projectRelevance !== "number"
      ) {
          throw new Error("Invalid project relevance score");
      }

      if (
        educationMatch !== null &&
        typeof educationMatch !== "number"
      ) {
          throw new Error("Invalid education match score");
      }

      if (
        totalScore !== null &&
        typeof totalScore !== "number"
      ) {
          throw new Error("Invalid total score");
      }

        const validatedScores = generateCandidateRemarks(aiResult, scoringWeights);
        const storedScores = scaleValidatedScoresForStorage(validatedScores);

        const existing = await Candidate.findOne({
          userId: req.user.id,
          job,
          groupName,
          $or: [
            { originalFileName: file.originalname },
            { name: file.originalname }
          ]
        });

        let candidate;

        if (existing) {
          existing.name = displayName;
          existing.groupName = groupName;
          existing.originalFileName = file.originalname;
          existing.score = storedScores.score;
          existing.technicalScore = storedScores.technicalScore;
          existing.softwareSoftSkillsScore = storedScores.softwareSoftSkillsScore;
          existing.experienceMatch = storedScores.experienceMatch;
          existing.projectRelevance = storedScores.projectRelevance;
          existing.educationMatch = storedScores.educationMatch;
          existing.totalScore = storedScores.totalScore;
          existing.finalScore = storedScores.finalScore;
          existing.matchPercentage = storedScores.match_percentage;
          existing.scoringVersion = CURRENT_SCORING_VERSION;
          existing.remarks = validatedScores.remarks;
          existing.scoringWeights = scoringWeights;
          existing.resumeText = text;
          existing.resumeMimeType = file.mimetype;
          existing.resumeFile = file.buffer;
          candidate = existing;
          console.log("Duplicate resume updated:", file.originalname);
        } else {
          candidate = new Candidate({
            userId: req.user.id,
            name: displayName,
            originalFileName: file.originalname,
            groupName,
            score: storedScores.score,
            technicalScore: storedScores.technicalScore,
            softwareSoftSkillsScore: storedScores.softwareSoftSkillsScore,
            experienceMatch: storedScores.experienceMatch,
            projectRelevance: storedScores.projectRelevance,
            educationMatch: storedScores.educationMatch,
            totalScore: storedScores.totalScore,
            finalScore: storedScores.finalScore,
            matchPercentage: storedScores.match_percentage,
            scoringVersion: CURRENT_SCORING_VERSION,
            remarks: validatedScores.remarks,
            scoringWeights,
            job,
            resumeText: text,
            resumeMimeType: file.mimetype,
            resumeFile: file.buffer
          });
        }

        await candidate.save();

        results.push(candidate);
      } catch (fileError) {
        console.error(`Failed to process ${file.originalname}:`, fileError);
        failedFiles.push({
          fileName: file.originalname,
          error: fileError.message
        });
      }
    }

    res.status(results.length > 0 ? 200 : 500).json({
      success: results.length > 0,
      message: failedFiles.length > 0
        ? "Some resumes were processed with errors"
        : "Resumes processed successfully",
      count: results.length,
      candidates: results.map(toApiCandidate),
      failedFiles
    });

  } catch (error) {

    console.error("Upload error:", error);

    res.status(500).json({
      success: false,
      message: "Error processing resumes",
      error: error.message
    });

  }

});

module.exports = router;
