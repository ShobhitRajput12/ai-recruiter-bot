const axios = require("axios");

const DEFAULT_CATEGORY_WEIGHTS = {
  technicalSkills: 30,
  softwareSoftSkills: 20,
  experience: 20,
  projects: 15,
  educationCertification: 15
};

const TECHNICAL_SKILL_KEYWORDS = [
  "javascript", "typescript", "python", "java", "c++", "c#", "react",
  "angular", "vue", "node", "node.js", "express", "django", "spring boot",
  "mongodb", "mysql", "postgresql", "sql", "docker", "kubernetes", "aws",
  "azure", "google cloud", "gcp", "git", "github", "html", "css",
  "tailwind", "api", "rest api", "restful api", "microservices",
  "machine learning", "data structures", "algorithms", "linux", "devops",
  "flask", "streamlit", "socket.io", "jwt", "opencv", "cnn", "oop",
  "object oriented programming", "database", "web development",
  "software development", "programming", "coding"
];

const TECHNICAL_SKILL_GROUPS = [
  { name: "javascript", aliases: ["javascript"] },
  { name: "typescript", aliases: ["typescript"] },
  { name: "python", aliases: ["python"] },
  { name: "java", aliases: ["java"] },
  { name: "c++", aliases: ["c++"] },
  { name: "c#", aliases: ["c#"] },
  { name: "react", aliases: ["react", "react.js"] },
  { name: "angular", aliases: ["angular"] },
  { name: "vue", aliases: ["vue", "vue.js"] },
  { name: "node", aliases: ["node", "node.js"] },
  { name: "express", aliases: ["express"] },
  { name: "django", aliases: ["django"] },
  { name: "spring boot", aliases: ["spring boot"] },
  { name: "flask", aliases: ["flask"] },
  { name: "mongodb", aliases: ["mongodb"] },
  { name: "mysql", aliases: ["mysql"] },
  { name: "postgresql", aliases: ["postgresql", "postgres"] },
  { name: "sql", aliases: ["sql"] },
  { name: "docker", aliases: ["docker"] },
  { name: "kubernetes", aliases: ["kubernetes", "k8s"] },
  { name: "aws", aliases: ["aws", "amazon web services"] },
  { name: "azure", aliases: ["azure"] },
  { name: "google cloud", aliases: ["google cloud", "gcp"] },
  { name: "git", aliases: ["git", "github"] },
  { name: "html", aliases: ["html"] },
  { name: "css", aliases: ["css"] },
  { name: "tailwind", aliases: ["tailwind", "tailwind css"] },
  { name: "api", aliases: ["api", "rest api", "restful api"] },
  { name: "microservices", aliases: ["microservices", "microservice"] },
  { name: "machine learning", aliases: ["machine learning", "ml"] },
  { name: "data structures", aliases: ["data structures"] },
  { name: "algorithms", aliases: ["algorithms"] },
  { name: "linux", aliases: ["linux"] },
  { name: "devops", aliases: ["devops"] },
  { name: "streamlit", aliases: ["streamlit"] },
  { name: "socket.io", aliases: ["socket.io", "socketio"] },
  { name: "jwt", aliases: ["jwt", "json web token"] },
  { name: "opencv", aliases: ["opencv"] },
  { name: "cnn", aliases: ["cnn", "convolutional neural network"] },
  { name: "oop", aliases: ["oop", "object oriented programming"] },
  { name: "database", aliases: ["database", "databases"] },
  { name: "web development", aliases: ["web development"] },
  { name: "software development", aliases: ["software development"] },
  { name: "programming", aliases: ["programming", "coding"] }
];

const SOFTWARE_AND_SOFT_SKILL_GROUPS = [
  { name: "jira", aliases: ["jira"] },
  { name: "confluence", aliases: ["confluence"] },
  { name: "slack", aliases: ["slack"] },
  { name: "trello", aliases: ["trello"] },
  { name: "asana", aliases: ["asana"] },
  { name: "figma", aliases: ["figma"] },
  { name: "postman", aliases: ["postman"] },
  { name: "excel", aliases: ["excel", "microsoft excel"] },
  { name: "power bi", aliases: ["power bi", "powerbi"] },
  { name: "tableau", aliases: ["tableau"] },
  { name: "agile", aliases: ["agile"] },
  { name: "scrum", aliases: ["scrum"] },
  { name: "communication", aliases: ["communication", "communicator"] },
  { name: "leadership", aliases: ["leadership", "led team", "team lead"] },
  { name: "collaboration", aliases: ["collaboration", "collaborative", "cross-functional"] },
  { name: "problem solving", aliases: ["problem solving", "problem-solving"] },
  { name: "analytical", aliases: ["analytical", "analysis"] },
  { name: "time management", aliases: ["time management"] },
  { name: "stakeholder management", aliases: ["stakeholder management", "stakeholder"] },
  { name: "presentation", aliases: ["presentation", "presented"] }
];

const CERTIFICATION_KEYWORDS = [
  "certification", "certified", "certificate", "aws certified",
  "azure certification", "google certification", "scrum master", "pmp"
];

const EDUCATION_KEYWORDS = [
  "computer science", "software engineering", "information technology",
  "computer applications", "mca", "bca", "b.tech", "btech", "m.tech",
  "engineering", "it", "bachelor", "master"
];

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

  return {
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

function normalizeText(text) {
  return String(text || "").toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textIncludesSkill(text, skill) {
  const normalizedText = normalizeText(text);
  const normalizedSkill = String(skill || "").trim().toLowerCase();

  if (!normalizedSkill) {
    return false;
  }

  if (normalizedText.includes(normalizedSkill)) {
    return true;
  }

  const compactSkill = normalizedSkill.replace(/[\s./+-]+/g, "");
  const compactText = normalizedText.replace(/[\s./+-]+/g, "");

  if (compactSkill && compactText.includes(compactSkill)) {
    return true;
  }

  const skillWords = normalizedSkill.split(/\s+/).filter(Boolean);
  if (skillWords.length > 1) {
    const flexiblePattern = skillWords.map(escapeRegExp).join("[\\s./+-]*");
    return new RegExp(flexiblePattern, "i").test(text);
  }

  return false;
}

function isSoftwareRole(job) {
  const normalizedJob = normalizeText(job);

  return [
    "software engineer", "software engineering", "software developer", "developer",
    "frontend", "backend", "full stack", "full-stack", "web developer",
    "application developer", "programmer", "coding", "technical intern", "engineering intern"
  ].some((keyword) => normalizedJob.includes(keyword));
}

function countExplicitEngineeringSignals(resume) {
  return TECHNICAL_SKILL_KEYWORDS.filter((skill) => textIncludesSkill(resume, skill)).length;
}

function getRelevantGroupMatches(groups, sourceText) {
  return groups
    .filter((group) => group.aliases.some((alias) => textIncludesSkill(sourceText, alias)))
    .map((group) => group.name);
}

function getMatchedGroups(groups, job, resume) {
  return groups
    .filter(
      (group) =>
        group.aliases.some((alias) => textIncludesSkill(job, alias)) &&
        group.aliases.some((alias) => textIncludesSkill(resume, alias))
    )
    .map((group) => group.name);
}

function getRelevantTechnicalSkills(job) {
  return getRelevantGroupMatches(TECHNICAL_SKILL_GROUPS, job);
}

function getMatchedTechnicalSkills(job, resume) {
  return getMatchedGroups(TECHNICAL_SKILL_GROUPS, job, resume);
}

function getRelevantSoftwareSoftSkills(job) {
  return getRelevantGroupMatches(SOFTWARE_AND_SOFT_SKILL_GROUPS, job);
}

function getMatchedSoftwareSoftSkills(job, resume) {
  return getMatchedGroups(SOFTWARE_AND_SOFT_SKILL_GROUPS, job, resume);
}

function parseExperienceRequirement(job) {
  const normalizedJob = normalizeText(job);

  const rangeMatch = normalizedJob.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s+years?/i);
  if (rangeMatch) {
    return {
      minYears: Number.parseInt(rangeMatch[1], 10),
      maxYears: Number.parseInt(rangeMatch[2], 10)
    };
  }

  const minimumMatch = normalizedJob.match(/(?:minimum|min\.?|at least)\s*(\d+)\+?\s+years?/i);
  if (minimumMatch) {
    return { minYears: Number.parseInt(minimumMatch[1], 10), maxYears: null };
  }

  const singleMatch = normalizedJob.match(/(\d+)\+?\s+years?\s+(?:of\s+)?(?:professional\s+)?experience/i);
  if (singleMatch) {
    return { minYears: Number.parseInt(singleMatch[1], 10), maxYears: null };
  }

  return null;
}

function getSectionText(resume, sectionStarts, sectionEnds) {
  const normalizedResume = normalizeText(resume);
  for (const startKeyword of sectionStarts) {
    const startIndex = normalizedResume.indexOf(startKeyword);
    if (startIndex === -1) {
      continue;
    }

    let endIndex = normalizedResume.length;
    for (const endKeyword of sectionEnds) {
      const candidateEndIndex = normalizedResume.indexOf(
        endKeyword,
        startIndex + startKeyword.length
      );
      if (candidateEndIndex !== -1 && candidateEndIndex < endIndex) {
        endIndex = candidateEndIndex;
      }
    }

    return normalizedResume.slice(startIndex, endIndex);
  }

  return "";
}

function estimateYearsFromText(text) {
  const yearRangePattern = /\b(20\d{2})\s*(?:-|–)\s*(20\d{2}|present|current)\b/gi;
  let totalMonths = 0;
  let match;

  while ((match = yearRangePattern.exec(text)) !== null) {
    const startYear = Number.parseInt(match[1], 10);
    const endYear = /present|current/i.test(match[2]) ? 2026 : Number.parseInt(match[2], 10);

    if (!Number.isNaN(startYear) && !Number.isNaN(endYear) && endYear >= startYear) {
      totalMonths += (endYear - startYear) * 12;
    }
  }

  return totalMonths / 12;
}

function estimateResumeExperienceYears(resume) {
  const normalizedResume = normalizeText(resume);
  const explicitYears = [
    ...normalizedResume.matchAll(
      /(\d+(?:\.\d+)?)\+?\s+years?\s+of\s+(?:professional\s+)?experience/gi
    )
  ]
    .map((item) => Number.parseFloat(item[1]))
    .filter((value) => !Number.isNaN(value));

  const experienceText = getSectionText(
    resume,
    ["professional experience", "work experience", "employment", "experience", "internship", "internships"],
    ["education", "projects", "skills", "certifications", "achievements", "interests", "summary", "professional summary"]
  );
  const derivedYears = experienceText ? estimateYearsFromText(experienceText) : 0;
  const bestExplicitYears = explicitYears.length > 0 ? Math.max(...explicitYears) : 0;

  return Math.max(derivedYears, bestExplicitYears);
}

function computeCoverageScore(relevantItems, matchedItems, options = {}) {
  const {
    noRequirementScore = 40,
    noRequirementResumeBoost = 0,
    baseWeight = 80,
    perMatchBonus = 4,
    minimumFloor = 0
  } = options;

  if (relevantItems.length === 0) {
    return clampScore(noRequirementScore + Math.min(noRequirementResumeBoost, 20), noRequirementScore);
  }

  const coverage = matchedItems.length / relevantItems.length;
  const score = Math.round(coverage * baseWeight + matchedItems.length * perMatchBonus);
  return clampScore(score, minimumFloor);
}

function deriveTechnicalScore(job, resume) {
  const relevantSkills = getRelevantTechnicalSkills(job);
  const matchedSkills = getMatchedTechnicalSkills(job, resume);
  const relevantCount = relevantSkills.length;
  const matchedCount = matchedSkills.length;

  if (relevantCount === 0) {
    return isSoftwareRole(job)
      ? Math.min(35, countExplicitEngineeringSignals(resume) * 4)
      : 25;
  }

  const coverage = matchedCount / relevantCount;
  const engineeringSignalCount = countExplicitEngineeringSignals(resume);
  let score = Math.round(coverage * 78 + matchedCount * 4 + Math.min(engineeringSignalCount, 8) * 2);

  if (coverage < 0.15) {
    score = Math.min(score, 22);
  } else if (coverage < 0.3) {
    score = Math.min(score, 38);
  } else if (coverage < 0.5) {
    score = Math.min(score, 58);
  } else if (coverage < 0.7) {
    score = Math.min(score, 78);
  } else if (coverage < 0.9) {
    score = Math.min(score, 90);
  } else if (matchedCount < 4) {
    score = Math.min(score, 93);
  }

  const hasStrongBreadth =
    relevantSkills.length >= 6 &&
    matchedSkills.length >= Math.max(relevantSkills.length - 1, 5);

  if (!hasStrongBreadth) {
    score = Math.min(score, 92);
  }

  if (isSoftwareRole(job)) {
    const engineeringSignals = countExplicitEngineeringSignals(resume);
    if (engineeringSignals === 0) {
      score = Math.min(score, 15);
    } else if (engineeringSignals <= 2) {
      score = Math.min(score, 35);
    } else if (engineeringSignals <= 4) {
      score = Math.min(score, 55);
    }
  }

  return clampScore(score, matchedCount > 0 ? matchedCount * 5 : 0);
}

function deriveSoftwareSoftSkillsScore(job, resume) {
  const relevantSkills = getRelevantSoftwareSoftSkills(job);
  const matchedSkills = getMatchedSoftwareSoftSkills(job, resume);
  const resumeSignals = getRelevantGroupMatches(SOFTWARE_AND_SOFT_SKILL_GROUPS, resume);

  if (relevantSkills.length === 0) {
    return clampScore(35 + resumeSignals.length * 6, 35);
  }

  let score = computeCoverageScore(relevantSkills, matchedSkills, {
    baseWeight: 82,
    perMatchBonus: 5,
    minimumFloor: matchedSkills.length > 0 ? 18 : 0
  });

  if (matchedSkills.length === 0) {
    score = Math.min(score, 20);
  }

  return clampScore(score, matchedSkills.length > 0 ? matchedSkills.length * 8 : 0);
}

function deriveExperienceMatch(job, resume) {
  const requirement = parseExperienceRequirement(job);
  const resumeYears = estimateResumeExperienceYears(resume);
  const experienceText = getSectionText(
    resume,
    ["professional experience", "work experience", "employment", "experience", "internship", "internships"],
    ["education", "projects", "skills", "certifications", "achievements", "interests", "summary", "professional summary"]
  );

  if (!requirement || !requirement.minYears) {
    return experienceText ? Math.min(80, 40 + Math.round(resumeYears * 10)) : 35;
  }

  const experienceGap = requirement.minYears - resumeYears;

  if (experienceGap <= 0) {
    return 90;
  }
  if (experienceGap <= 0.5) {
    return 75;
  }
  if (experienceGap <= 1) {
    return 60;
  }
  if (experienceGap <= 2) {
    return 42;
  }
  if (experienceGap <= 3) {
    return 25;
  }

  return experienceText ? 15 : 5;
}

function deriveProjectRelevance(job, resume) {
  const projectText = getSectionText(
    resume,
    ["projects", "project", "personal projects", "academic projects"],
    ["experience", "education", "skills", "certifications", "achievements", "interests"]
  );

  if (!projectText) {
    return 10;
  }

  const relevantSkills = getRelevantTechnicalSkills(job);
  const matchedProjectSkills = relevantSkills.filter((skill) => textIncludesSkill(projectText, skill));

  if (relevantSkills.length === 0) {
    return 45;
  }

  const coverage = matchedProjectSkills.length / relevantSkills.length;
  let score = Math.round(coverage * 85 + matchedProjectSkills.length * 3);

  if (coverage < 0.2) {
    score = Math.min(score, 28);
  } else if (coverage < 0.4) {
    score = Math.min(score, 45);
  } else if (coverage < 0.6) {
    score = Math.min(score, 65);
  } else if (coverage < 0.8) {
    score = Math.min(score, 82);
  }

  return clampScore(score, 12);
}

function deriveEducationCertificationScore(job, resume) {
  const normalizedJob = normalizeText(job);
  const educationText = getSectionText(
    resume,
    ["education", "education and training", "academic background"],
    ["projects", "experience", "skills", "certifications", "achievements", "interests"]
  );
  const certificationText = getSectionText(
    resume,
    ["certifications", "certification", "licenses"],
    ["projects", "experience", "skills", "education", "achievements", "interests"]
  );
  const combinedEducationText = `${educationText} ${certificationText}`.trim() || normalizeText(resume);

  const relevantEducationKeywords = EDUCATION_KEYWORDS.filter((keyword) => normalizedJob.includes(keyword));
  const matchedEducationKeywords = relevantEducationKeywords.filter((keyword) =>
    combinedEducationText.includes(keyword)
  );
  const relevantCertificationKeywords = CERTIFICATION_KEYWORDS.filter((keyword) =>
    normalizedJob.includes(keyword)
  );
  const matchedCertificationKeywords = relevantCertificationKeywords.filter((keyword) =>
    combinedEducationText.includes(keyword)
  );

  if (
    /bachelor.?s degree|bachelor degree|bachelor/.test(normalizedJob) &&
    /bachelor|b\.sc|bsc|b\.tech|btech|bca/.test(combinedEducationText)
  ) {
    matchedEducationKeywords.push("bachelor");
  }

  const relevantTotal = [...new Set([
    ...relevantEducationKeywords,
    ...relevantCertificationKeywords
  ])];
  const matchedTotal = [...new Set([
    ...matchedEducationKeywords,
    ...matchedCertificationKeywords
  ])];

  if (relevantTotal.length === 0) {
    const hasRelevantEducation = /computer|it|software|mca|bca|btech|engineering/.test(combinedEducationText);
    const hasCertifications = CERTIFICATION_KEYWORDS.some((keyword) =>
      combinedEducationText.includes(keyword)
    );
    return hasRelevantEducation || hasCertifications ? 75 : 45;
  }

  const coverage = matchedTotal.length / relevantTotal.length;
  return clampScore(Math.round(coverage * 90 + matchedCertificationKeywords.length * 5), 25);
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

function deriveLocalScores(job, resume, categoryWeights) {
  const technicalSkillsScore = deriveTechnicalScore(job, resume);
  const softwareSoftSkillsScore = deriveSoftwareSoftSkillsScore(job, resume);
  const experienceScore = deriveExperienceMatch(job, resume);
  const projectsScore = deriveProjectRelevance(job, resume);
  const educationCertificationScore = deriveEducationCertificationScore(job, resume);
  const weightedScores = calculateFinalScore({
    technicalSkillsScore,
    softwareSoftSkillsScore,
    experienceScore,
    projectsScore,
    educationCertificationScore
  }, categoryWeights);

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

function mergeWithLocalScores(parsed, localScores, categoryWeights) {
  return validateScoreShape(parsed, localScores, categoryWeights);
}

async function scoreResume(resume, job, categoryWeights) {
  const normalizedWeights = normalizeCategoryWeights(categoryWeights);
  const localScores = deriveLocalScores(job, resume, normalizedWeights);

  try {
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

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model,
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const text = response.data.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return mergeWithLocalScores(parsed, localScores, normalizedWeights);
  } catch (error) {
    console.log("Groq Error:", error.response?.data || error.message);
    return localScores;
  }
}

module.exports = scoreResume;
module.exports.generateCandidateRemarks = generateCandidateRemarks;
module.exports.validateScoreShape = validateScoreShape;
module.exports.calculateWeightedScore = calculateWeightedScore;
module.exports.normalizeCategoryWeights = normalizeCategoryWeights;
module.exports.getCategoryWeightTotal = getCategoryWeightTotal;
module.exports.DEFAULT_CATEGORY_WEIGHTS = DEFAULT_CATEGORY_WEIGHTS;
