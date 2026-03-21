const scoreResume = require("./aiScore");
const {
  generateCandidateRemarks,
  normalizeCategoryWeights
} = require("./aiScore");
const {
  CURRENT_SCORING_VERSION,
  scaleValidatedScoresForStorage,
  toHundred
} = require("./scoreScale");

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
      const storedScores = scaleValidatedScoresForStorage(validatedScores);

      candidate.technicalScore = storedScores.technicalScore;
      candidate.softwareSoftSkillsScore = storedScores.softwareSoftSkillsScore;
      candidate.experienceMatch = storedScores.experienceMatch;
      candidate.projectRelevance = storedScores.projectRelevance;
      candidate.educationMatch = storedScores.educationMatch;
      candidate.totalScore = storedScores.totalScore;
      candidate.finalScore = storedScores.finalScore;
      candidate.matchPercentage = storedScores.match_percentage;
      candidate.scoringVersion = CURRENT_SCORING_VERSION;
      candidate.score = storedScores.score;
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
  if (!candidate.remarks) {
    const scoringWeights = normalizeCategoryWeights(candidate.scoringWeights);
    const sourceScores =
      Number(candidate.scoringVersion || 0) >= CURRENT_SCORING_VERSION
        ? {
          technicalScore: toHundred(candidate.technicalScore),
          softwareSoftSkillsScore: toHundred(candidate.softwareSoftSkillsScore),
          experienceMatch: toHundred(candidate.experienceMatch),
          projectRelevance: toHundred(candidate.projectRelevance),
          educationMatch: toHundred(candidate.educationMatch),
          totalScore: toHundred(candidate.totalScore ?? candidate.finalScore ?? candidate.score),
          finalScore: toHundred(candidate.finalScore ?? candidate.totalScore ?? candidate.score),
          match_percentage: toHundred(
            candidate.matchPercentage ?? candidate.finalScore ?? candidate.totalScore ?? candidate.score
          )
        }
        : candidate;

    candidate.remarks = generateCandidateRemarks(sourceScores, scoringWeights).remarks;
  }

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
