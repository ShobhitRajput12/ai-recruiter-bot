const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_CATEGORY_WEIGHTS = {
  technicalSkills: 30,
  softwareSoftSkills: 20,
  experience: 20,
  projects: 15,
  educationCertification: 15
};


function clampScore(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, parsed));
}

function clampNumericScore(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Number(parsed.toFixed(2))));
}

function normalizeWeightValue(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, parsed));
}

function normalizeCategoryWeights(input = {}) {
  const safeInput = input && typeof input === "object" ? input : {};

  const normalized = {
    technicalSkills: normalizeWeightValue(
      safeInput.technicalSkills,
      DEFAULT_CATEGORY_WEIGHTS.technicalSkills
    ),
    softwareSoftSkills: normalizeWeightValue(
      safeInput.softwareSoftSkills,
      DEFAULT_CATEGORY_WEIGHTS.softwareSoftSkills
    ),
    experience: normalizeWeightValue(
      safeInput.experience,
      DEFAULT_CATEGORY_WEIGHTS.experience
    ),
    projects: normalizeWeightValue(
      safeInput.projects,
      DEFAULT_CATEGORY_WEIGHTS.projects
    ),
    educationCertification: normalizeWeightValue(
      safeInput.educationCertification,
      DEFAULT_CATEGORY_WEIGHTS.educationCertification
    )
  };

  const values = Object.values(normalized).filter((value) => Number.isFinite(value));
  const total = values.reduce((sum, value) => sum + value, 0);
  const maxValue = values.length ? Math.max(...values) : 0;

  if (total > 0 && total <= 10.5 && maxValue <= 10) {
    return {
      technicalSkills: normalized.technicalSkills * 10,
      softwareSoftSkills: normalized.softwareSoftSkills * 10,
      experience: normalized.experience * 10,
      projects: normalized.projects * 10,
      educationCertification: normalized.educationCertification * 10
    };
  }

  return normalized;
}

function getCategoryWeightTotal(weights) {
  if (!weights || typeof weights !== "object") {
    return 0;
  }

  return [
    weights.technicalSkills,
    weights.softwareSoftSkills,
    weights.experience,
    weights.projects,
    weights.educationCertification
  ].reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function safeScore(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return clampScore(fallback, 0);
  }

  return clampScore(Math.round(parsed), 0);
}

function calculateWeightedScore(individualScore, categoryWeight) {
  return clampNumericScore((safeScore(individualScore) * categoryWeight) / 100, 0);
}

function calculateFinalScore(scores, categoryWeights = DEFAULT_CATEGORY_WEIGHTS) {
  const normalizedWeights = normalizeCategoryWeights(categoryWeights);

  const weightedTechnicalSkills = calculateWeightedScore(
    scores.technicalSkillsScore,
    normalizedWeights.technicalSkills
  );
  const weightedSoftwareSoftSkills = calculateWeightedScore(
    scores.softwareSoftSkillsScore,
    normalizedWeights.softwareSoftSkills
  );
  const weightedExperience = calculateWeightedScore(
    scores.experienceScore,
    normalizedWeights.experience
  );
  const weightedProjects = calculateWeightedScore(
    scores.projectsScore,
    normalizedWeights.projects
  );
  const weightedEducationCertification = calculateWeightedScore(
    scores.educationCertificationScore,
    normalizedWeights.educationCertification
  );

  return {
    weightedTechnicalSkills,
    weightedSoftwareSoftSkills,
    weightedExperience,
    weightedProjects,
    weightedEducationCertification,
    finalScore: clampNumericScore(
      weightedTechnicalSkills +
        weightedSoftwareSoftSkills +
        weightedExperience +
        weightedProjects +
        weightedEducationCertification,
      0
    )
  };
}

function withLegacyAndJsonAliases(baseScores) {
  return {
    ...baseScores,
    technicalScore: baseScores.technicalSkillsScore,
    softwareSoftSkillsScore: baseScores.softwareSoftSkillsScore,
    experienceMatch: baseScores.experienceScore,
    projectRelevance: baseScores.projectsScore,
    educationMatch: baseScores.educationCertificationScore,
    totalScore: baseScores.finalScore,
    score: baseScores.finalScore,
    technical_skills_score: baseScores.technicalSkillsScore,
    software_soft_skills_score: baseScores.softwareSoftSkillsScore,
    experience_score: baseScores.experienceScore,
    projects_score: baseScores.projectsScore,
    education_certification_score: baseScores.educationCertificationScore,
    final_score: baseScores.finalScore,
    match_percentage: baseScores.finalScore
  };
}


function validateScoreShape(rawScores, localScores, categoryWeights) {
  const technicalSkillsScore = safeScore(
    rawScores?.technicalSkillsScore ?? rawScores?.technicalScore ?? rawScores?.technical_skills_score,
    localScores.technicalSkillsScore
  );
  const softwareSoftSkillsScore = safeScore(
    rawScores?.softwareSoftSkillsScore ??
      rawScores?.software_soft_skills_score ??
      rawScores?.softwareSoftSkillScore,
    localScores.softwareSoftSkillsScore
  );
  const experienceScore = safeScore(
    rawScores?.experienceScore ?? rawScores?.experienceMatch ?? rawScores?.experience_score,
    localScores.experienceScore
  );
  const projectsScore = safeScore(
    rawScores?.projectsScore ?? rawScores?.projectRelevance ?? rawScores?.projects_score,
    localScores.projectsScore
  );
  const educationCertificationScore = safeScore(
    rawScores?.educationCertificationScore ??
      rawScores?.educationMatch ??
      rawScores?.education_certification_score,
    localScores.educationCertificationScore
  );

  const weightedScores = calculateFinalScore({
    technicalSkillsScore,
    softwareSoftSkillsScore,
    experienceScore,
    projectsScore,
    educationCertificationScore
  }, categoryWeights);

  const providedFinalScore = clampNumericScore(
    rawScores?.finalScore ?? rawScores?.totalScore ?? rawScores?.final_score,
    weightedScores.finalScore
  );
  const finalScore =
    Math.abs(providedFinalScore - weightedScores.finalScore) > 12
      ? weightedScores.finalScore
      : providedFinalScore;

  return withLegacyAndJsonAliases({
    technicalSkillsScore,
    softwareSoftSkillsScore,
    experienceScore,
    projectsScore,
    educationCertificationScore,
    weightedTechnicalSkills: weightedScores.weightedTechnicalSkills,
    weightedSoftwareSoftSkills: weightedScores.weightedSoftwareSoftSkills,
    weightedExperience: weightedScores.weightedExperience,
    weightedProjects: weightedScores.weightedProjects,
    weightedEducationCertification: weightedScores.weightedEducationCertification,
    finalScore
  });
}

function getBand(score) {
  if (score >= 80) {
    return "strong";
  }
  if (score >= 60) {
    return "good";
  }
  if (score >= 40) {
    return "mixed";
  }
  if (score >= 20) {
    return "weak";
  }
  return "very weak";
}

function generateCandidateRemarks(scores, categoryWeights) {
  const normalized = validateScoreShape(scores, scores, categoryWeights);
  const strengths = [];
  const concerns = [];

  const dimensions = [
    {
      label: "technical alignment",
      score: normalized.technicalSkillsScore,
      strongText: "technical skills align well with the role requirements",
      weakText: "technical skill overlap with the role is limited"
    },
    {
      label: "software and soft skills alignment",
      score: normalized.softwareSoftSkillsScore,
      strongText: "software tools and soft-skill signals support the role requirements",
      weakText: "software tools or soft-skill alignment is limited"
    },
    {
      label: "experience alignment",
      score: normalized.experienceScore,
      strongText: "experience level is close to the role expectations",
      weakText: "experience level appears below the role expectations"
    },
    {
      label: "project relevance",
      score: normalized.projectsScore,
      strongText: "projects show relevant hands-on work",
      weakText: "projects do not strongly support the target role"
    },
    {
      label: "education and certification alignment",
      score: normalized.educationCertificationScore,
      strongText: "education or certifications support the job requirements",
      weakText: "education or certification background is not a close match for the role"
    }
  ];

  for (const dimension of dimensions) {
    if (dimension.score >= 70) {
      strengths.push(dimension.strongText);
    } else if (dimension.score <= 39) {
      concerns.push(dimension.weakText);
    }
  }

  if (strengths.length === 0) {
    const bestDimension = [...dimensions].sort((a, b) => b.score - a.score)[0];
    strengths.push(
      bestDimension.score > 0
        ? `${bestDimension.label} is the candidate's strongest available signal`
        : "profile needs deeper manual review because strong matching signals were limited"
    );
  }

  if (concerns.length === 0 && normalized.finalScore < 65) {
    concerns.push("overall fit is not yet convincing and should be reviewed manually");
  }

  const fitLabel = getBand(normalized.finalScore);
  const remarks = `Overall fit is ${fitLabel}. ${strengths[0]}. ${
    concerns[0] || "no major blockers were detected from the parsed resume."
  }.`;

  return {
    ...normalized,
    remarks
  };
}


async function scoreResume(resume, job, categoryWeights) {
  const normalizedWeights = normalizeCategoryWeights(categoryWeights);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const prompt = `
Compare this resume against the job description.

Job Description:
${job}

Resume:
${resume}

Return valid JSON only in this exact shape:
{
  "technical_skills_score": number,
  "software_soft_skills_score": number,
  "experience_score": number,
  "projects_score": number,
  "education_certification_score": number,
  "final_score": number,
  "match_percentage": number
}

Rules:
- each category score must be from 0 to 100
- calculate technical_skills_score, software_soft_skills_score, experience_score, projects_score, and education_certification_score individually out of 100
- use weights: technical skills ${normalizedWeights.technicalSkills}, software tools / soft skills ${normalizedWeights.softwareSoftSkills}, experience ${normalizedWeights.experience}, projects ${normalizedWeights.projects}, education / certification ${normalizedWeights.educationCertification}
- final_score = (technical_skills_score * ${normalizedWeights.technicalSkills} / 100) + (software_soft_skills_score * ${normalizedWeights.softwareSoftSkills} / 100) + (experience_score * ${normalizedWeights.experience} / 100) + (projects_score * ${normalizedWeights.projects} / 100) + (education_certification_score * ${normalizedWeights.educationCertification} / 100)
- match_percentage should equal final_score
- do not add markdown
- do not add explanation text
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const response = await model.generateContent(prompt);
    const text = response?.response?.text?.() || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const technicalSkillsScore = safeScore(
      parsed?.technical_skills_score ?? parsed?.technicalSkillsScore ?? parsed?.technicalScore,
      0
    );
    const softwareSoftSkillsScore = safeScore(
      parsed?.software_soft_skills_score ?? parsed?.softwareSoftSkillsScore,
      0
    );
    const experienceScore = safeScore(
      parsed?.experience_score ?? parsed?.experienceScore ?? parsed?.experienceMatch,
      0
    );
    const projectsScore = safeScore(
      parsed?.projects_score ?? parsed?.projectsScore ?? parsed?.projectRelevance,
      0
    );
    const educationCertificationScore = safeScore(
      parsed?.education_certification_score ??
        parsed?.educationCertificationScore ??
        parsed?.educationMatch,
      0
    );

    const weightedScores = calculateFinalScore({
      technicalSkillsScore,
      softwareSoftSkillsScore,
      experienceScore,
      projectsScore,
      educationCertificationScore
    }, normalizedWeights);

    return withLegacyAndJsonAliases({
      technicalSkillsScore,
      softwareSoftSkillsScore,
      experienceScore,
      projectsScore,
      educationCertificationScore,
      weightedTechnicalSkills: weightedScores.weightedTechnicalSkills,
      weightedSoftwareSoftSkills: weightedScores.weightedSoftwareSoftSkills,
      weightedExperience: weightedScores.weightedExperience,
      weightedProjects: weightedScores.weightedProjects,
      weightedEducationCertification: weightedScores.weightedEducationCertification,
      finalScore: weightedScores.finalScore
    });
  } catch (error) {
    console.log("Gemini Error:", error.message);
    return withLegacyAndJsonAliases({
      technicalSkillsScore: 0,
      softwareSoftSkillsScore: 0,
      experienceScore: 0,
      projectsScore: 0,
      educationCertificationScore: 0,
      weightedTechnicalSkills: 0,
      weightedSoftwareSoftSkills: 0,
      weightedExperience: 0,
      weightedProjects: 0,
      weightedEducationCertification: 0,
      finalScore: 0
    });
  }
}

module.exports = scoreResume;
module.exports.generateCandidateRemarks = generateCandidateRemarks;
module.exports.validateScoreShape = validateScoreShape;
module.exports.calculateWeightedScore = calculateWeightedScore;
module.exports.normalizeCategoryWeights = normalizeCategoryWeights;
module.exports.getCategoryWeightTotal = getCategoryWeightTotal;
module.exports.DEFAULT_CATEGORY_WEIGHTS = DEFAULT_CATEGORY_WEIGHTS;
