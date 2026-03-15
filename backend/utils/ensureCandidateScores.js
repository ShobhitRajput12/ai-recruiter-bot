const scoreResume = require("./aiScore");
const {
  generateCandidateRemarks,
  normalizeCategoryWeights
} = require("./aiScore");
const CURRENT_SCORING_VERSION = 2;

async function ensureCandidateScores(candidate) {
  const hasResumeData =
    candidate.resumeText &&
    candidate.resumeText !== "Unable to extract resume text" &&
    candidate.job;
  const hasTechnical = typeof candidate.technicalScore === "number";
  const hasSoftwareSoft = typeof candidate.softwareSoftSkillsScore === "number";
  const hasExperience = typeof candidate.experienceMatch === "number";
  const hasProject = typeof candidate.projectRelevance === "number";
  const hasEducation = typeof candidate.educationMatch === "number";
  const hasTotal =
    typeof candidate.totalScore === "number" || typeof candidate.finalScore === "number";
  const allScoresPresent =
    hasTechnical && hasSoftwareSoft && hasExperience && hasProject && hasEducation && hasTotal;
  const needsScoringVersionUpgrade =
    Number(candidate.scoringVersion || 0) < CURRENT_SCORING_VERSION;
  const looksUninitialized =
    allScoresPresent &&
    candidate.technicalScore === 0 &&
    candidate.softwareSoftSkillsScore === 0 &&
    candidate.experienceMatch === 0 &&
    candidate.projectRelevance === 0 &&
    candidate.educationMatch === 0 &&
    (candidate.totalScore === 0 || candidate.finalScore === 0);
  const looksLikeLegacyPartialScore =
    hasResumeData &&
    (
      candidate.softwareSoftSkillsScore == null ||
      candidate.educationMatch == null ||
      (candidate.technicalScore > 0 &&
        (candidate.softwareSoftSkillsScore === 0 || candidate.educationMatch === 0))
    );

  if (
    allScoresPresent &&
    !looksUninitialized &&
    !needsScoringVersionUpgrade &&
    !looksLikeLegacyPartialScore
  ) {
    return candidate;
  }

  if (hasResumeData) {
    try {
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
      candidate.scoringVersion = CURRENT_SCORING_VERSION;
      candidate.score = validatedScores.totalScore;
      candidate.remarks = validatedScores.remarks;
      candidate.scoringWeights = scoringWeights;
      await candidate.save();

      return candidate;
    } catch (error) {
      console.error("Failed to backfill AI scores:", error);
    }
  }

  candidate.totalScore = candidate.totalScore ?? candidate.score ?? null;
  candidate.finalScore = candidate.finalScore ?? candidate.totalScore ?? candidate.score ?? null;
  candidate.matchPercentage =
    candidate.matchPercentage ?? candidate.finalScore ?? candidate.totalScore ?? candidate.score ?? null;
  candidate.scoringVersion = candidate.scoringVersion ?? null;
  candidate.technicalScore = candidate.technicalScore ?? null;
  candidate.softwareSoftSkillsScore = candidate.softwareSoftSkillsScore ?? null;
  candidate.experienceMatch = candidate.experienceMatch ?? null;
  candidate.projectRelevance = candidate.projectRelevance ?? null;
  candidate.educationMatch = candidate.educationMatch ?? null;
  candidate.remarks =
    candidate.remarks ||
    generateCandidateRemarks(candidate, normalizeCategoryWeights(candidate.scoringWeights))
      .remarks;

  return candidate;
}

async function ensureCandidateScoresForList(candidates) {
  const updatedCandidates = [];

  for (const candidate of candidates) {
    updatedCandidates.push(await ensureCandidateScores(candidate));
  }

  return updatedCandidates;
}

module.exports = {
  ensureCandidateScores,
  ensureCandidateScoresForList
};
