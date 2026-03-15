const express = require("express");
const Candidate = require("../models/Candidate");
const scoreResume = require("../utils/aiScore");
const {
  generateCandidateRemarks,
  normalizeCategoryWeights
} = require("../utils/aiScore");
const {
  ensureCandidateScores,
  ensureCandidateScoresForList
} = require("../utils/ensureCandidateScores");
const { getDisplayCandidateName } = require("../utils/candidateName");

const router = express.Router();
const LIST_PROJECTION = "-resumeFile";

function resolveSortField(sortBy) {
  if (sortBy === "final_score") {
    return "finalScore";
  }

  return sortBy || "createdAt";
}

function withDisplayName(candidate) {
  const plainCandidate = candidate.toObject ? candidate.toObject() : candidate;
  const finalScore =
    plainCandidate.finalScore ?? plainCandidate.totalScore ?? plainCandidate.score ?? null;

  return {
    ...plainCandidate,
    name: getDisplayCandidateName(plainCandidate),
    technical_skills_score: plainCandidate.technicalScore ?? null,
    software_soft_skills_score: plainCandidate.softwareSoftSkillsScore ?? null,
    experience_score: plainCandidate.experienceMatch ?? null,
    projects_score: plainCandidate.projectRelevance ?? null,
    education_certification_score: plainCandidate.educationMatch ?? null,
    final_score: finalScore,
    match_percentage: plainCandidate.matchPercentage ?? finalScore
  };
}

router.get("/groups", async (req, res) => {
  try {
    const groups = await Candidate.aggregate([
      {
        $match: {
          groupName: { $exists: true, $ne: "" }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$groupName",
          candidateCount: { $sum: 1 },
          latestUpload: { $first: "$createdAt" },
          job: { $first: "$job" }
        }
      },
      {
        $project: {
          _id: 0,
          groupName: "$_id",
          candidateCount: 1,
          latestUpload: 1,
          job: {
            $ifNull: ["$job", ""]
          }
        }
      },
      {
        $sort: { latestUpload: -1, groupName: 1 }
      }
    ]);

    res.json(groups);
  } catch (err) {
    console.error("Error fetching candidate groups:", err);
    res.status(500).json({ error: "Failed to fetch candidate groups" });
  }
});

// Get all candidates (optionally sorted and limited)
router.get("/", async (req, res) => {
  try {
    const sortField = resolveSortField(req.query.sortBy);
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    const limit = parseInt(req.query.limit, 10) || 0;
    const groupName =
      typeof req.query.groupName === "string" ? req.query.groupName.trim() : "";
    const filters = groupName ? { groupName } : {};

    const candidates = await Candidate.find(filters)
      .select(LIST_PROJECTION)
      .sort({ [sortField]: sortOrder })
      .limit(limit);

    const hydratedCandidates = await ensureCandidateScoresForList(candidates);
    res.json(hydratedCandidates.map(withDisplayName));
  } catch (err) {
    console.error("Error fetching candidates:", err);
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

// Get latest candidates (by upload date)
router.get("/latest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    const groupName =
      typeof req.query.groupName === "string" ? req.query.groupName.trim() : "";
    const filters = groupName ? { groupName } : {};
    const candidates = await Candidate.find(filters)
      .select(LIST_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(limit);

    const hydratedCandidates = await ensureCandidateScoresForList(candidates);
    res.json(hydratedCandidates.map(withDisplayName));
  } catch (err) {
    console.error("Error fetching latest candidates:", err);
    res.status(500).json({ error: "Failed to fetch latest candidates" });
  }
});

// Get top candidates (by score)
router.get("/top", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    const groupName =
      typeof req.query.groupName === "string" ? req.query.groupName.trim() : "";
    const filters = groupName ? { groupName } : {};
    const candidates = await Candidate.find(filters)
      .select(LIST_PROJECTION)
      .sort({ finalScore: -1, totalScore: -1, score: -1 })
      .limit(limit);

    const hydratedCandidates = await ensureCandidateScoresForList(candidates);
    hydratedCandidates.sort(
      (a, b) =>
        (b.finalScore || b.totalScore || b.score || 0) -
        (a.finalScore || a.totalScore || a.score || 0)
    );

    res.json(hydratedCandidates.map(withDisplayName));
  } catch (err) {
    console.error("Error fetching top candidates:", err);
    res.status(500).json({ error: "Failed to fetch top candidates" });
  }
});

// Get a candidate by id
router.get("/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    res.json(withDisplayName(await ensureCandidateScores(candidate)));
  } catch (err) {
    console.error("Error fetching candidate:", err);
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

// Rescore a candidate against its saved job description and resume text
router.post("/:id/rescore", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    if (
      !candidate.job ||
      !candidate.resumeText ||
      candidate.resumeText === "Unable to extract resume text"
    ) {
      return res.status(400).json({
        error: "Candidate does not have enough data to rescore"
      });
    }

    const scoringWeights = normalizeCategoryWeights(candidate.scoringWeights);
    const aiScores = await scoreResume(candidate.resumeText, candidate.job, scoringWeights);

    const validatedScores = generateCandidateRemarks(aiScores, scoringWeights);

    candidate.technicalScore = validatedScores.technicalScore;
    candidate.softwareSoftSkillsScore = validatedScores.softwareSoftSkillsScore;
    candidate.experienceMatch = validatedScores.experienceMatch;
    candidate.projectRelevance = validatedScores.projectRelevance;
    candidate.educationMatch = validatedScores.educationMatch;
    candidate.totalScore = validatedScores.totalScore;
    candidate.finalScore = validatedScores.finalScore;
    candidate.matchPercentage = validatedScores.match_percentage;
    candidate.scoringVersion = 2;
    candidate.score = validatedScores.totalScore;
    candidate.remarks = validatedScores.remarks;
    candidate.scoringWeights = scoringWeights;
    await candidate.save();

    res.json(withDisplayName(candidate));
  } catch (err) {
    console.error("Error rescoring candidate:", err);
    res.status(502).json({ error: "Failed to rescore candidate" });
  }
});

// View a candidate's original resume file
router.get("/:id/file", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id).select(
      "name originalFileName resumeMimeType resumeFile resumeText"
    );

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    if (!candidate.resumeFile || !candidate.resumeMimeType) {
      if (candidate.resumeText) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${candidate.originalFileName || candidate.name || "resume"}.txt"`
        );
        return res.send(candidate.resumeText);
      }

      return res.status(404).json({ error: "Resume file not available" });
    }

    res.setHeader("Content-Type", candidate.resumeMimeType);

    const isWordFile =
      candidate.resumeMimeType === "application/msword" ||
      candidate.resumeMimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    res.setHeader(
      "Content-Disposition",
      `${isWordFile ? "attachment" : "inline"}; filename="${candidate.originalFileName || candidate.name || "resume"}"`
    );
    res.send(candidate.resumeFile);
  } catch (err) {
    console.error("Error fetching resume file:", err);
    res.status(500).json({ error: "Failed to fetch resume file" });
  }
});

// Delete a candidate by id
router.delete("/:id", async (req, res) => {
  try {
    const deletedCandidate = await Candidate.findByIdAndDelete(req.params.id);

    if (!deletedCandidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    res.json({ message: "Candidate deleted successfully" });
  } catch (err) {
    console.error("Error deleting candidate:", err);
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});

module.exports = router;
