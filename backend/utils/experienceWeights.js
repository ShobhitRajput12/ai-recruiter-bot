const EXPERIENCE_BANDS = [
  {
    min: 0,
    max: 2,
    weights: {
      education: 35,
      skills: 30,
      projects: 25,
      experience: 10
    }
  },
  {
    min: 1,
    max: 3,
    weights: {
      education: 20,
      skills: 35,
      projects: 20,
      experience: 25
    }
  },
  {
    min: 3,
    max: 5,
    weights: {
      education: 15,
      skills: 35,
      projects: 15,
      experience: 35
    }
  },
  {
    min: 5,
    max: 10,
    weights: {
      education: 10,
      skills: 35,
      projects: 10,
      experience: 45
    }
  },
  {
    min: 10,
    max: 15,
    weights: {
      education: 10,
      skills: 30,
      projects: 5,
      experience: 55
    }
  }
];

const SKILL_SPLIT = {
  technical: 0.6,
  soft: 0.4
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getOverlapLength(minExp, maxExp, band) {
  const overlapStart = Math.max(minExp, band.min);
  const overlapEnd = Math.min(maxExp, band.max);
  return Math.max(0, overlapEnd - overlapStart);
}

function getBandProximity(point, band) {
  if (point < band.min || point > band.max) {
    return 0;
  }

  const center = (band.min + band.max) / 2;
  const halfRange = (band.max - band.min) / 2;
  if (halfRange === 0) {
    return 1;
  }

  const distance = Math.abs(point - center);
  return clamp(1 - distance / halfRange, 0, 1);
}

function blendWeightsByOverlaps(minExp, maxExp) {
  const totalRange = maxExp - minExp;
  const weights = { education: 0, skills: 0, projects: 0, experience: 0 };
  let totalOverlap = 0;

  for (const band of EXPERIENCE_BANDS) {
    const overlap = getOverlapLength(minExp, maxExp, band);
    if (overlap <= 0) {
      continue;
    }

    totalOverlap += overlap;
    weights.education += band.weights.education * overlap;
    weights.skills += band.weights.skills * overlap;
    weights.projects += band.weights.projects * overlap;
    weights.experience += band.weights.experience * overlap;
  }

  if (totalOverlap === 0) {
    return null;
  }

  return {
    education: weights.education / totalOverlap,
    skills: weights.skills / totalOverlap,
    projects: weights.projects / totalOverlap,
    experience: weights.experience / totalOverlap
  };
}

function blendWeightsByProximity(point) {
  const weights = { education: 0, skills: 0, projects: 0, experience: 0 };
  let totalWeight = 0;

  for (const band of EXPERIENCE_BANDS) {
    const proximity = getBandProximity(point, band);
    if (proximity <= 0) {
      continue;
    }

    totalWeight += proximity;
    weights.education += band.weights.education * proximity;
    weights.skills += band.weights.skills * proximity;
    weights.projects += band.weights.projects * proximity;
    weights.experience += band.weights.experience * proximity;
  }

  if (totalWeight === 0) {
    return null;
  }

  return {
    education: weights.education / totalWeight,
    skills: weights.skills / totalWeight,
    projects: weights.projects / totalWeight,
    experience: weights.experience / totalWeight
  };
}

function normalizeToTen(values) {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return values;
  }

  const scaled = {};
  for (const [key, value] of Object.entries(values)) {
    scaled[key] = (value / total) * 10;
  }

  return scaled;
}

function roundToOneDecimal(values) {
  const rounded = {};
  for (const [key, value] of Object.entries(values)) {
    rounded[key] = Number(value.toFixed(1));
  }

  const sumRounded = Object.values(rounded).reduce((sum, value) => sum + value, 0);
  const diff = Number((10 - sumRounded).toFixed(1));

  if (diff !== 0) {
    const targetKey = Object.keys(rounded).sort((a, b) => rounded[b] - rounded[a])[0];
    rounded[targetKey] = Number((rounded[targetKey] + diff).toFixed(1));
  }

  return rounded;
}

function resolveWeights(minExpInput, maxExpInput) {
  let minExp = toNumber(minExpInput, 0);
  let maxExp = toNumber(maxExpInput, minExp);

  if (minExp > maxExp) {
    [minExp, maxExp] = [maxExp, minExp];
  }

  if (minExp === maxExp) {
    return (
      blendWeightsByProximity(minExp) ||
      blendWeightsByOverlaps(minExp, maxExp) ||
      EXPERIENCE_BANDS[EXPERIENCE_BANDS.length - 1].weights
    );
  }

  const blended = blendWeightsByOverlaps(minExp, maxExp);
  if (blended) {
    return blended;
  }

  const nearestBand = minExp < EXPERIENCE_BANDS[0].min
    ? EXPERIENCE_BANDS[0]
    : EXPERIENCE_BANDS[EXPERIENCE_BANDS.length - 1];
  return nearestBand.weights;
}

function getWeights(minExp, maxExp) {
  const baseWeights = resolveWeights(minExp, maxExp);

  const splitSkills = {
    technicalSkills: baseWeights.skills * SKILL_SPLIT.technical,
    softSkills: baseWeights.skills * SKILL_SPLIT.soft,
    experience: baseWeights.experience,
    projects: baseWeights.projects,
    education: baseWeights.education
  };

  const normalized = normalizeToTen(splitSkills);
  return roundToOneDecimal(normalized);
}

module.exports = { getWeights };
