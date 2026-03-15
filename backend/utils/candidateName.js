function looksLikeFilename(value) {
  return typeof value === "string" && /\.[a-z0-9]{2,5}$/i.test(value.trim());
}

function cleanLine(line) {
  return line
    .replace(/\s+/g, " ")
    .replace(/[_|]/g, " ")
    .trim();
}

function isLikelyName(line) {
  if (!line) {
    return false;
  }

  if (line.length < 3 || line.length > 60) {
    return false;
  }

  if (/@|\d{4,}|linkedin|github|gmail|hotmail|outlook|resume|curriculum vitae|education/i.test(line)) {
    return false;
  }

  const words = line.split(/\s+/).filter(Boolean);

  if (words.length < 2 || words.length > 5) {
    return false;
  }

  if (words.some((word) => word.length < 3)) {
    return false;
  }

  const shortWords = words.filter((word) => word.length <= 2).length;
  if (shortWords > 1) {
    return false;
  }

  const weirdCaseWords = words.filter(
    (word) => /[A-Z]/.test(word) && /[a-z]/.test(word) && !/^[A-Z][a-z.'-]+$/.test(word)
  ).length;
  if (weirdCaseWords > 0) {
    return false;
  }

  const vowelPoorWords = words.filter((word) => !/[aeiou]/i.test(word)).length;
  if (vowelPoorWords >= Math.ceil(words.length / 2)) {
    return false;
  }

  return words.every((word) => /^[A-Za-z.'-]+$/.test(word));
}

function shouldReplaceStoredName(name) {
  if (!name || typeof name !== "string") {
    return true;
  }

  const cleaned = cleanLine(name);

  if (looksLikeFilename(cleaned)) {
    return true;
  }

  return !isLikelyName(cleaned);
}

function toTitleCase(line) {
  return line
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeHandleToName(handle) {
  if (!handle) {
    return "";
  }

  const cleaned = handle
    .replace(/\d+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  return toTitleCase(cleaned);
}

function extractUppercaseNameLine(resumeText) {
  const lines = resumeText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 20);

  for (const line of lines) {
    if (!/^[A-Z][A-Z\s.'-]+$/.test(line)) {
      continue;
    }

    const normalized = toTitleCase(line);
    if (isLikelyName(normalized)) {
      return normalized;
    }
  }

  return "";
}

function extractNameFromContactDetails(resumeText) {
  const emailMatch = resumeText.match(/\b([a-zA-Z]+[a-zA-Z._-]*[a-zA-Z]+)\d{0,4}@/);
  if (emailMatch) {
    const emailName = normalizeHandleToName(emailMatch[1]);
    if (isLikelyName(emailName)) {
      return emailName;
    }
  }

  const linkedInMatch = resumeText.match(
    /linkedin\s*\.?\s*com\s*\/?\s*in\s*\/?\s*([a-zA-Z0-9._-]+)/i
  );
  if (linkedInMatch) {
    const linkedInName = normalizeHandleToName(linkedInMatch[1]);
    if (isLikelyName(linkedInName)) {
      return linkedInName;
    }
  }

  const githubMatch = resumeText.match(
    /github\s*\.?\s*com\s*\/?\s*([a-zA-Z0-9._-]+)/i
  );
  if (githubMatch) {
    const githubName = normalizeHandleToName(githubMatch[1]);
    if (isLikelyName(githubName)) {
      return githubName;
    }
  }

  return "";
}

function extractCandidateNameFromResume(
  resumeText,
  fallbackName = "Candidate",
  options = {}
) {
  if (!resumeText || typeof resumeText !== "string") {
    return fallbackName;
  }

  const isImageResume =
    options.mimeType === "image/png" ||
    options.mimeType === "image/jpeg" ||
    options.mimeType === "image/jpg";

  if (isImageResume) {
    const uppercaseName = extractUppercaseNameLine(resumeText);
    if (uppercaseName) {
      return uppercaseName;
    }

    const contactDerivedName = extractNameFromContactDetails(resumeText);
    if (contactDerivedName) {
      return contactDerivedName;
    }
  }

  const lines = resumeText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 12);

  for (const line of lines) {
    if (!isLikelyName(line)) {
      continue;
    }

    if (/[a-z]/.test(line) && /[A-Z]/.test(line)) {
      return line;
    }

    return toTitleCase(line);
  }

  const contactDerivedName = extractNameFromContactDetails(resumeText);
  if (contactDerivedName) {
    return contactDerivedName;
  }

  return fallbackName;
}

function getDisplayCandidateName(candidate) {
  const fallbackName = candidate.originalFileName || candidate.name || "Candidate";

  if (!shouldReplaceStoredName(candidate.name)) {
    return candidate.name || fallbackName;
  }

  return extractCandidateNameFromResume(candidate.resumeText, fallbackName, {
    mimeType: candidate.resumeMimeType
  });
}

module.exports = {
  extractCandidateNameFromResume,
  getDisplayCandidateName,
  looksLikeFilename,
  shouldReplaceStoredName
};
