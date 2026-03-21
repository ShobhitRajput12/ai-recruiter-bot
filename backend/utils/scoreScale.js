const CURRENT_SCORING_VERSION = 3;

function toTen(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Number((parsed / 10).toFixed(2));
}

function toHundred(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Number((parsed * 10).toFixed(2));
}

function normalizeApiScore(value, scoringVersion) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (Number(scoringVersion || 0) >= CURRENT_SCORING_VERSION) {
    return Number(parsed.toFixed(2));
  }
  return Number((parsed / 10).toFixed(2));
}

function scaleValidatedScoresForStorage(validatedScores) {
  return {
    technicalScore: toTen(validatedScores.technicalScore),
    softwareSoftSkillsScore: toTen(validatedScores.softwareSoftSkillsScore),
    experienceMatch: toTen(validatedScores.experienceMatch),
    projectRelevance: toTen(validatedScores.projectRelevance),
    educationMatch: toTen(validatedScores.educationMatch),
    totalScore: toTen(validatedScores.totalScore),
    finalScore: toTen(validatedScores.finalScore),
    match_percentage: toTen(validatedScores.match_percentage),
    score: toTen(validatedScores.totalScore)
  };
}

module.exports = {
  CURRENT_SCORING_VERSION,
  toTen,
  toHundred,
  normalizeApiScore,
  scaleValidatedScoresForStorage
};
