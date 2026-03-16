import React, { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { API_BASE_URL } from "./config";
import "./App.css";

const SCORE_BANDS = [
  { min: 80, label: "Strong" },
  { min: 60, label: "Good" },
  { min: 40, label: "Mixed" },
  { min: 20, label: "Weak" },
  { min: 0, label: "Very weak" }
];

const PDF_FIELD_DEFAULTS = {
  name: true,
  scoreDetails: true,
  remarks: true,
  allDetails: false
};

const DEFAULT_SCORE_WEIGHTS = {
  technicalSkills: 30,
  softwareSoftSkills: 20,
  experience: 20,
  projects: 15,
  educationCertification: 15
};

const AUTH_TOKEN_KEY = "hirebud_ai_token";
const USER_STORAGE_KEY = "user";
const LEGACY_TOKEN_KEY = "token";

function cleanLine(line) {
  return (line || "").replace(/\s+/g, " ").replace(/[_|]/g, " ").trim();
}

function isFilenameLike(value) {
  return /\.[a-z0-9]{2,5}$/i.test((value || "").trim());
}

function isLikelyPersonName(value) {
  const line = cleanLine(value);

  if (!line || line.length < 3 || line.length > 60) {
    return false;
  }

  if (
    /@|\d{4,}|linkedin|github|gmail|hotmail|outlook|education|resume|technical skills|skills|projects|experience|certifications|leadership|activities|contact/i.test(
      line
    )
  ) {
    return false;
  }

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) {
    return false;
  }

  if (words.some((word) => word.length < 3)) {
    return false;
  }

  return words.every((word) => /^[A-Za-z.'-]+$/.test(word));
}

function toTitleCase(value) {
  return cleanLine(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function getFileCategory(file) {
  if (!file) {
    return "Unknown";
  }

  if (file.type.startsWith("image/")) {
    return "Image";
  }
  if (file.type === "application/pdf") {
    return "PDF";
  }
  if (file.type === "application/msword") {
    return "DOC";
  }
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOCX";
  }
  return file.name.split(".").pop()?.toUpperCase() || "File";
}

function createPreviewEntry(file) {
  const previewable =
    file.type.startsWith("image/") || file.type === "application/pdf";

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    previewUrl: previewable ? URL.createObjectURL(file) : "",
    previewKind: file.type.startsWith("image/")
      ? "image"
      : file.type === "application/pdf"
        ? "pdf"
        : "icon"
  };
}

function getDisplayName(candidate) {
  if (!candidate) {
    return "Candidate";
  }

  if (!isFilenameLike(candidate.name) && isLikelyPersonName(candidate.name)) {
    return candidate.name;
  }

  const resumeText = candidate.resumeText || "";
  const lines = resumeText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, 20);

  const uppercaseLine = lines.find((line) => /^[A-Z][A-Z\s.'-]+$/.test(line));
  if (uppercaseLine) {
    const normalized = toTitleCase(uppercaseLine);
    if (isLikelyPersonName(normalized)) {
      return normalized;
    }
  }

  const regularLine = lines.find((line) => isLikelyPersonName(line));
  if (regularLine) {
    return /[a-z]/.test(regularLine) ? regularLine : toTitleCase(regularLine);
  }

  return candidate.name || candidate.originalFileName || "Candidate";
}

function getScoreValue(candidate, key) {
  const aliasMap = {
    technicalScore: "technical_skills_score",
    softwareSoftSkillsScore: "software_soft_skills_score",
    experienceMatch: "experience_score",
    projectRelevance: "projects_score",
    educationMatch: "education_certification_score",
    finalScore: "final_score"
  };

  const directValue = candidate?.[key];
  if (typeof directValue === "number") {
    return directValue;
  }

  const aliasValue = candidate?.[aliasMap[key]];
  return typeof aliasValue === "number" ? aliasValue : null;
}

function getTotalScore(candidate) {
  return getScoreValue(candidate, "finalScore") ??
    (typeof candidate?.totalScore === "number"
      ? candidate.totalScore
      : typeof candidate?.score === "number"
        ? candidate.score
        : typeof candidate?.match_percentage === "number"
          ? candidate.match_percentage
          : null);
}

function sortCandidatesByFinalScore(candidates, sortOrder = "desc") {
  const direction = sortOrder === "asc" ? 1 : -1;

  return [...candidates].sort((leftCandidate, rightCandidate) => {
    const leftScore = getTotalScore(leftCandidate) ?? 0;
    const rightScore = getTotalScore(rightCandidate) ?? 0;

    return (leftScore - rightScore) * direction;
  });
}

function formatScore(value) {
  return typeof value === "number" ? `${value} / 100` : "Pending";
}

function getBandLabel(value) {
  if (typeof value !== "number") {
    return "Pending";
  }

  return SCORE_BANDS.find((band) => value >= band.min)?.label || "Pending";
}

function buildFallbackRemarks(candidate) {
  const technicalScore = getScoreValue(candidate, "technicalScore");
  const softwareSoftSkillsScore = getScoreValue(candidate, "softwareSoftSkillsScore");
  const experienceMatch = getScoreValue(candidate, "experienceMatch");
  const projectRelevance = getScoreValue(candidate, "projectRelevance");
  const educationMatch = getScoreValue(candidate, "educationMatch");
  const totalScore = getTotalScore(candidate);

  const dimensions = [
    { label: "technical alignment", value: technicalScore },
    { label: "software and soft skills alignment", value: softwareSoftSkillsScore },
    { label: "experience match", value: experienceMatch },
    { label: "project relevance", value: projectRelevance },
    { label: "education alignment", value: educationMatch }
  ];

  const strongest = [...dimensions]
    .filter((item) => typeof item.value === "number")
    .sort((a, b) => b.value - a.value)[0];
  const weakest = [...dimensions]
    .filter((item) => typeof item.value === "number")
    .sort((a, b) => a.value - b.value)[0];

  const strongText = strongest
    ? `${strongest.label} is the best signal right now`
    : "resume data is still incomplete";
  const weakText =
    weakest && weakest.value <= 45
      ? `${weakest.label} needs closer manual review`
      : "no major blocker stands out from the available scoring";

  return `Overall fit is ${getBandLabel(totalScore).toLowerCase()}. ${strongText}. ${weakText}.`;
}

function getCandidateRemarks(candidate) {
  const remarks = cleanLine(candidate?.remarks);
  return remarks || buildFallbackRemarks(candidate);
}

function formatPdfScore(value) {
  return typeof value === "number" ? `${value} / 100` : "Pending";
}

function buildPdfSections(candidate, fieldSelection) {
  const includeAllDetails = fieldSelection.allDetails;
  const sections = [];

  if (fieldSelection.name || includeAllDetails) {
    sections.push({
      label: "Name",
      value: getDisplayName(candidate)
    });
  }

  if (fieldSelection.scoreDetails || includeAllDetails) {
    if (includeAllDetails) {
      sections.push({
        label: "Technical Skills Score",
        value: formatPdfScore(getScoreValue(candidate, "technicalScore"))
      });
      sections.push({
        label: "Soft Skills Score",
        value: formatPdfScore(getScoreValue(candidate, "softwareSoftSkillsScore"))
      });
      sections.push({
        label: "Experience Score",
        value: formatPdfScore(getScoreValue(candidate, "experienceMatch"))
      });
      sections.push({
        label: "Projects Score",
        value: formatPdfScore(getScoreValue(candidate, "projectRelevance"))
      });
      sections.push({
        label: "Education / Certification Score",
        value: formatPdfScore(getScoreValue(candidate, "educationMatch"))
      });
      sections.push({
        label: "Final Score",
        value: formatPdfScore(getTotalScore(candidate))
      });
    } else {
      sections.push({
        label: "Final Score",
        value: formatPdfScore(getTotalScore(candidate))
      });
    }
  }

  if (fieldSelection.remarks || includeAllDetails) {
    sections.push({
      label: "Remarks",
      value: getCandidateRemarks(candidate)
    });
  }

  return sections;
}

function PreviewCard({ item, onRemove }) {
  return (
    <article className="upload-preview-card">
      <div className="upload-preview-media">
        {item.previewKind === "image" && (
          <img src={item.previewUrl} alt={item.file.name} className="upload-preview-image" />
        )}
        {item.previewKind === "pdf" && (
          <iframe title={item.file.name} src={item.previewUrl} className="upload-preview-frame" />
        )}
        {item.previewKind === "icon" && (
          <div className="upload-preview-placeholder">{getFileCategory(item.file)}</div>
        )}
      </div>
      <div className="upload-preview-content">
        <div>
          <p className="upload-preview-name">{item.file.name}</p>
          <p className="upload-preview-meta">
            {getFileCategory(item.file)} · {formatBytes(item.file.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="upload-preview-remove"
        >
          Remove
        </button>
      </div>
    </article>
  );
}

function CandidateCard({
  candidate,
  deletingIds,
  viewingId,
  onDelete,
  onView,
  selected,
  onToggleSelect,
  showDate = false
}) {
  return (
    <article className="candidate-card">
      <div className="candidate-card-header">
        <div>
          <label className="candidate-select-row">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(candidate._id)}
            />
            <span>Select candidate</span>
          </label>
          <p className="candidate-card-group">
            {candidate.groupName ? `Group: ${candidate.groupName}` : "Ungrouped"}
          </p>
          <h3 className="candidate-card-name">{getDisplayName(candidate)}</h3>
        </div>
        <div className="candidate-card-actions">
          <button
            type="button"
            onClick={() => onView(candidate)}
            disabled={viewingId === candidate._id}
            className="candidate-card-button dark"
          >
            {viewingId === candidate._id ? "Opening..." : "View resume"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(candidate._id, candidate.name)}
            disabled={deletingIds.includes(candidate._id)}
            className="candidate-card-button danger"
          >
            {deletingIds.includes(candidate._id) ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="candidate-score-grid">
        <div>
          <span>Technical Skill</span>
          <strong>{formatScore(getScoreValue(candidate, "technicalScore"))}</strong>
        </div>
        <div>
          <span>Soft Skill</span>
          <strong>{formatScore(getScoreValue(candidate, "softwareSoftSkillsScore"))}</strong>
        </div>
        <div>
          <span>Experience</span>
          <strong>{formatScore(getScoreValue(candidate, "experienceMatch"))}</strong>
        </div>
        <div>
          <span>Projects</span>
          <strong>{formatScore(getScoreValue(candidate, "projectRelevance"))}</strong>
        </div>
        <div>
          <span>Education</span>
          <strong>{formatScore(getScoreValue(candidate, "educationMatch"))}</strong>
        </div>
      </div>

      <div className="candidate-total-row">
        <div>
          <span className="candidate-total-label">Overall fit</span>
          <strong>{formatScore(getTotalScore(candidate))}</strong>
        </div>
        <span className={`candidate-chip band-${getBandLabel(getTotalScore(candidate)).toLowerCase().replace(/\s+/g, "-")}`}>
          {getBandLabel(getTotalScore(candidate))}
        </span>
      </div>

      <div className="candidate-progress">
        <span style={{ width: `${getTotalScore(candidate) ?? 0}%` }} />
      </div>

      <p className="candidate-remarks">{getCandidateRemarks(candidate)}</p>

      {showDate && candidate.createdAt && (
        <p className="candidate-date">
          Uploaded on {new Date(candidate.createdAt).toLocaleDateString()}
        </p>
      )}
    </article>
  );
}

function App() {
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem(AUTH_TOKEN_KEY) || ""
  );
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [storedUser, setStoredUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const userMenuRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [job, setJob] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groups, setGroups] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSortOrder, setCandidateSortOrder] = useState("desc");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("");
  const [latestCandidates, setLatestCandidates] = useState([]);
  const [topCandidates, setTopCandidates] = useState([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [scoreWeights, setScoreWeights] = useState(DEFAULT_SCORE_WEIGHTS);
  const [isWeightsOpen, setIsWeightsOpen] = useState(true);
  const [isPdfOptionsOpen, setIsPdfOptionsOpen] = useState(false);
  const [pdfFieldSelection, setPdfFieldSelection] = useState(PDF_FIELD_DEFAULTS);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);
  const [viewingId, setViewingId] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const latestFilesRef = useRef(files);
  const [isJobGenOpen, setIsJobGenOpen] = useState(false);
  const [jobGenErrors, setJobGenErrors] = useState({});
  const [generatedJobDesc, setGeneratedJobDesc] = useState("");
  const [jobGenData, setJobGenData] = useState({
    title: "",
    level: "",
    employmentType: "",
    workArrangement: "",
    location: "",
    timezone: "",
    responsibilities: "",
    impact: "",
    mustHave: "",
    niceToHave: "",
    experience: "",
    education: "",
    salaryRange: "",
    benefits: {
      health: false,
      equity: false,
      remoteStipend: false,
      learningBudget: false,
      flexibleHours: false,
      pto: false,
      wfhEquipment: false,
      bonus: false
    },
    benefitsOther: "",
    companyDescription: "",
    roleExcitement: ""
    ,
    priorities: [
      "technicalSkills",
      "softwareSoftSkills",
      "experience",
      "projects",
      "educationCertification"
    ]
  });

  function persistAuthToken(nextToken) {
    setAuthToken(nextToken);
    if (nextToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
      localStorage.setItem(LEGACY_TOKEN_KEY, nextToken);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  }

  function persistUser(nextUser) {
    setStoredUser(nextUser);
    if (nextUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }

  function handleLogout() {
    persistAuthToken("");
    persistUser(null);
    window.location.href = "/login";
  }

  function buildAuthHeaders(baseHeaders = {}) {
    const headers = { ...baseHeaders };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  }

  async function fetchWithAuth(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: buildAuthHeaders(options.headers || {})
    });

    if (response.status === 401) {
      persistAuthToken("");
    }

    return response;
  }

  const normalizedCandidateSearch = candidateSearch.trim().toLowerCase();
  const filteredLatestCandidates = latestCandidates.filter((candidate) => {
    if (!normalizedCandidateSearch) {
      return true;
    }

    const groupLabel = (candidate.groupName || "").toLowerCase();
    return groupLabel.includes(normalizedCandidateSearch);
  });
  const filteredTopCandidates = topCandidates.filter((candidate) => {
    if (!normalizedCandidateSearch) {
      return true;
    }

    const groupLabel = (candidate.groupName || "").toLowerCase();
    return groupLabel.includes(normalizedCandidateSearch);
  });
  const sortedLatestCandidates = sortCandidatesByFinalScore(
    filteredLatestCandidates,
    candidateSortOrder
  );
  const sortedTopCandidates = sortCandidatesByFinalScore(
    filteredTopCandidates,
    candidateSortOrder
  );
  const totalCandidatesShown =
    sortedLatestCandidates.length + sortedTopCandidates.length;
  const weightTotal = Object.values(scoreWeights).reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0
  );
  const weightsAreValid = weightTotal === 100;
  const candidateDirectory = [...new Map(
    [...latestCandidates, ...topCandidates].map((candidate) => [candidate._id, candidate])
  ).values()];
  const selectedCandidates = candidateDirectory.filter((candidate) =>
    selectedCandidateIds.includes(candidate._id)
  );

  useEffect(() => {
    if (authToken) {
      loadDashboard();
    }
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setLatestCandidates([]);
      setTopCandidates([]);
      setGroups([]);
      setSelectedCandidateIds([]);
    }
  }, [authToken]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  function updateJobGenField(field, value) {
    setJobGenData((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateBenefit(field, checked) {
    setJobGenData((current) => ({
      ...current,
      benefits: {
        ...current.benefits,
        [field]: checked
      }
    }));
  }

  function updatePriority(index, key) {
    setJobGenData((current) => {
      const currentOrder = Array.isArray(current.priorities)
        ? [...current.priorities]
        : [];

      const filtered = currentOrder.filter((item) => item !== key);
      const nextOrder = [...filtered];

      nextOrder.splice(index, 0, key);

      const requiredKeys = [
        "technicalSkills",
        "softwareSoftSkills",
        "experience",
        "projects",
        "educationCertification"
      ];

      requiredKeys.forEach((requiredKey) => {
        if (!nextOrder.includes(requiredKey)) {
          nextOrder.push(requiredKey);
        }
      });

      return {
        ...current,
        priorities: nextOrder.slice(0, requiredKeys.length)
      };
    });
  }

  function validateJobGen(data) {
    const nextErrors = {};

    if (!data.title.trim()) nextErrors.title = "Job title is required.";
    if (!data.level) nextErrors.level = "Select a seniority level.";
    if (!data.employmentType) nextErrors.employmentType = "Select employment type.";
    if (!data.workArrangement) nextErrors.workArrangement = "Select work arrangement.";
    if (!data.responsibilities.trim()) nextErrors.responsibilities = "Add responsibilities.";
    if (!data.mustHave.trim()) nextErrors.mustHave = "List must-have skills.";

    if (
      (data.workArrangement === "Hybrid" || data.workArrangement === "On-site") &&
      !data.location.trim()
    ) {
      nextErrors.location = "Location is required for hybrid or on-site roles.";
    }

    return nextErrors;
  }

  function buildJobDescription(data) {
    const benefitsList = [];
    if (data.benefits.health) benefitsList.push("Health insurance");
    if (data.benefits.equity) benefitsList.push("Stock options / ESOP");
    if (data.benefits.remoteStipend) benefitsList.push("Remote work stipend");
    if (data.benefits.learningBudget) benefitsList.push("Learning budget");
    if (data.benefits.flexibleHours) benefitsList.push("Flexible hours");
    if (data.benefits.pto) benefitsList.push("Paid time off");
    if (data.benefits.wfhEquipment) benefitsList.push("Work-from-home equipment");
    if (data.benefits.bonus) benefitsList.push("Performance bonus");
    if (data.benefitsOther.trim()) benefitsList.push(data.benefitsOther.trim());

    const priorityLabels = {
      technicalSkills: "Technical Skills",
      softwareSoftSkills: "Soft Skills",
      experience: "Experience",
      projects: "Projects",
      educationCertification: "Education / Certifications"
    };

    const order =
      Array.isArray(data.priorities) && data.priorities.length === 5
        ? data.priorities
        : [
            "technicalSkills",
            "softwareSoftSkills",
            "experience",
            "projects",
            "educationCertification"
          ];

    const priorityLines = order
      .map((key, index) => {
        const label = priorityLabels[key] || key;
        const value = Number(scoreWeights[key] ?? 0);
        return `${index + 1}. ${label} (${value}%)`;
      })
      .join("\n");

    const sections = [
      `Job Title\n${data.title.trim()}`,
      `Company Overview\n${data.companyDescription.trim() || "Share your company mission and values."}`,
      `About the Role\n${data.impact.trim() || "Define the primary goal and impact for this role."}`,
      `Responsibilities\n${data.responsibilities.trim()}`,
      `Required Skills\n${data.mustHave.trim()}`,
      `Preferred Skills\n${data.niceToHave.trim() || "Nice-to-have skills and technologies."}`,
      `Experience Required\n${data.experience || "No minimum"}` +
        (data.education.trim() ? `\nEducation / Certifications\n${data.education.trim()}` : ""),
      `Scoring Priorities\n${priorityLines || "Not specified"}`,
      `Work Arrangement\n${data.workArrangement}`,
      `Location\n${data.location.trim() || "Not specified"}`,
      `Salary & Benefits\n${data.salaryRange.trim() || "Salary range to be discussed."}` +
        `\nBenefits & Perks\n${benefitsList.length ? benefitsList.join(", ") : "Not specified"}`,
      `Why Join Us\n${data.roleExcitement.trim() || "Highlight what makes this role exciting."}`
    ];

    return sections.join("\n\n");
  }

  function handleGenerateJobDescription() {
    const nextErrors = validateJobGen(jobGenData);
    setJobGenErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const jd = buildJobDescription(jobGenData);
    setGeneratedJobDesc(jd);
  }

  async function handleCopyJobDescription() {
    if (!generatedJobDesc.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedJobDesc);
      window.alert("Job description copied to clipboard.");
    } catch (err) {
      window.alert("Copy failed. Please select and copy manually.");
    }
  }

  function handleUseJobDescription() {
    if (!generatedJobDesc.trim()) {
      return;
    }
    setJob(generatedJobDesc);
    setIsJobGenOpen(false);
  }

  useEffect(() => {
    latestFilesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      latestFilesRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");

    if (authMode === "signup" && authPassword !== authConfirm) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthLoading(true);

    try {
      const endpoint = authMode === "signup" ? "/auth/register" : "/auth/login";
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (!data.token) {
        throw new Error("No token returned from server");
      }

      persistAuthToken(data.token);
      if (data.user) {
        persistUser(data.user);
      } else {
        persistUser({ email: authEmail.trim().toLowerCase() });
      }
      setAuthPassword("");
      setAuthConfirm("");
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadDashboard() {
    try {
      const [latestRes, topRes, groupsRes] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL}/candidates/latest`),
        fetchWithAuth(`${API_BASE_URL}/candidates/top`),
        fetchWithAuth(`${API_BASE_URL}/candidates/groups`)
      ]);

      if (!latestRes.ok || !topRes.ok || !groupsRes.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const [latestData, topData, groupData] = await Promise.all([
        latestRes.json(),
        topRes.json(),
        groupsRes.json()
      ]);

      const nextLatestCandidates = Array.isArray(latestData) ? latestData : [];
      const nextTopCandidates = Array.isArray(topData) ? topData : [];
      const nextCandidateIds = new Set(
        [...nextLatestCandidates, ...nextTopCandidates]
          .map((candidate) => candidate?._id)
          .filter(Boolean)
      );

      setLatestCandidates(nextLatestCandidates);
      setTopCandidates(nextTopCandidates);
      setGroups(Array.isArray(groupData) ? groupData : []);
      setSelectedCandidateIds((currentIds) =>
        currentIds.filter((candidateId) => nextCandidateIds.has(candidateId))
      );
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
  }

  function handleReuseGroupClick(group) {
    setGroupName(group.groupName || "");
    setJob(group.job || "");
  }

  function toggleCandidateSelection(candidateId) {
    if (!candidateId) {
      return;
    }

    setSelectedCandidateIds((currentIds) =>
      currentIds.includes(candidateId)
        ? currentIds.filter((id) => id !== candidateId)
        : [...currentIds, candidateId]
    );
  }

  function updatePdfFieldSelection(fieldKey) {
    setPdfFieldSelection((currentSelection) => {
      if (fieldKey === "allDetails") {
        return {
          ...currentSelection,
          allDetails: !currentSelection.allDetails
        };
      }

      return {
        ...currentSelection,
        allDetails: false,
        [fieldKey]: !currentSelection[fieldKey]
      };
    });
  }

  function updateScoreWeight(key, rawValue) {
    const nextValue = Number(rawValue);
    const clamped = Number.isFinite(nextValue)
      ? Math.max(0, Math.min(100, nextValue))
      : 0;

    setScoreWeights((current) => ({
      ...current,
      [key]: clamped
    }));
  }

  function resetScoreWeights() {
    setScoreWeights(DEFAULT_SCORE_WEIGHTS);
  }

  function generateCandidatePdf() {
    if (selectedCandidates.length === 0) {
      window.alert("Select at least one candidate before downloading a PDF.");
      return;
    }

    const hasSelectedField =
      pdfFieldSelection.allDetails ||
      pdfFieldSelection.name ||
      pdfFieldSelection.scoreDetails ||
      pdfFieldSelection.remarks;

    if (!hasSelectedField) {
      window.alert("Choose at least one field to include in the PDF.");
      return;
    }

    const doc = new jsPDF({
      unit: "pt",
      format: "a4"
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = margin;

    const ensureSpace = (neededHeight) => {
      if (cursorY + neededHeight <= pageHeight - margin) {
        return;
      }

      doc.addPage();
      cursorY = margin;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Candidate Export", margin, cursorY);
    cursorY += 24;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Selected candidates: ${selectedCandidates.length} | Sort: ${candidateSortOrder === "asc" ? "Lowest first" : "Highest first"}`,
      margin,
      cursorY
    );
    cursorY += 28;

    selectedCandidates.forEach((candidate, index) => {
      const sections = buildPdfSections(candidate, pdfFieldSelection);
      const estimatedHeight = 42 + sections.length * 34;
      ensureSpace(estimatedHeight);

      doc.setDrawColor(214, 198, 177);
      doc.setFillColor(255, 251, 245);
      doc.roundedRect(margin, cursorY, contentWidth, 28, 10, 10, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(
        `${index + 1}. ${getDisplayName(candidate)}`,
        margin + 14,
        cursorY + 18
      );
      cursorY += 42;

      sections.forEach((section) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(section.label, margin, cursorY);
        cursorY += 14;

        doc.setFont("helvetica", "normal");
        const wrappedLines = doc.splitTextToSize(String(section.value || "-"), contentWidth);
        const blockHeight = wrappedLines.length * 14 + 8;
        ensureSpace(blockHeight + 8);
        doc.text(wrappedLines, margin, cursorY);
        cursorY += blockHeight;
      });

      cursorY += 8;
    });

    doc.save("selected-candidates.pdf");
    setIsPdfOptionsOpen(false);
  }

  const groupedPreviewHint = !groupName.trim()
    ? "Add a group name to keep these resumes together under one role pipeline."
    : `${files.length} resume${files.length === 1 ? "" : "s"} will be uploaded to the "${groupName.trim()}" group.`;

  function addFiles(incomingFiles) {
    const selectedFiles = Array.from(incomingFiles || []);
    if (selectedFiles.length === 0) {
      return;
    }

    setUploadSummary(null);
    setFiles((currentFiles) => {
      const mergedFiles = [...currentFiles];

      for (const file of selectedFiles) {
        const id = `${file.name}-${file.size}-${file.lastModified}`;
        const alreadyAdded = mergedFiles.some((item) => item.id === id);

        if (!alreadyAdded) {
          mergedFiles.push(createPreviewEntry(file));
        }
      }

      return mergedFiles;
    });
  }

  function handleFileChange(event) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  function removeSelectedFile(fileId) {
    setFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((item) => item.id !== fileId);
      const removed = currentFiles.find((item) => item.id === fileId);

      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return nextFiles;
    });
  }

  function clearSelectedFiles() {
    files.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setFiles([]);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragActive(false);
    addFiles(event.dataTransfer.files);
  }

  async function uploadResumes() {
    setLoading(true);

    try {
      if (!authToken) {
        window.alert("Please sign in to upload resumes.");
        return;
      }

      if (!files.length) {
        window.alert("Please choose at least one resume file.");
        return;
      }

      if (!job.trim()) {
        window.alert("Please paste a job description.");
        return;
      }

      if (!weightsAreValid) {
        window.alert("Scoring weights must add up to 100.");
        return;
      }

      const formData = new FormData();
      files.forEach((item) => formData.append("resumes", item.file));
      formData.append("job", job.trim());
      formData.append("groupName", groupName.trim());
      formData.append("weights", JSON.stringify(scoreWeights));

      const res = await fetchWithAuth(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok && !Array.isArray(data.candidates)) {
        throw new Error(data.error || data.message || "Upload failed");
      }

      setUploadSummary({
        uploadedCount: data.count ?? 0,
        groupName: groupName.trim(),
        failedFiles: Array.isArray(data.failedFiles) ? data.failedFiles : []
      });

      clearSelectedFiles();
      setQuestion("");
      setAnswer("");
      await loadDashboard();
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadSummary(null);
      window.alert(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function askChatbot() {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          groupName: selectedGroupFilter
        })
      });

      const data = await res.json();
      setAnswer(data.answer || "No answer received.");
    } catch (err) {
      console.error("Chat request failed:", err);
      setAnswer("Chat request failed. Please try again.");
    }
  }

  async function fetchCandidateDetails(candidateId) {
    const res = await fetchWithAuth(`${API_BASE_URL}/candidates/${candidateId}`);

    if (!res.ok) {
      let errorMessage = "Failed to load candidate details.";

      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Keep fallback message.
      }

      throw new Error(errorMessage);
    }

    return res.json();
  }

  async function deleteCandidate(candidateId, candidateName) {
    if (!candidateId) {
      window.alert("This resume cannot be deleted because its ID is missing.");
      return;
    }

    const confirmed = window.confirm(`Delete ${candidateName || "this resume"}?`);
    if (!confirmed) {
      return;
    }

    setDeletingIds((current) => [...current, candidateId]);

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/candidates/${candidateId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        let errorMessage = "Failed to delete candidate";

        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Keep fallback message.
        }

        throw new Error(errorMessage);
      }

      setLatestCandidates((current) =>
        current.filter((candidate) => candidate._id !== candidateId)
      );
      setTopCandidates((current) =>
        current.filter((candidate) => candidate._id !== candidateId)
      );

      await loadDashboard();
    } catch (err) {
      console.error("Delete failed:", err);
      window.alert(`Failed to delete resume: ${err.message}`);
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== candidateId));
    }
  }

  function hasReadableResumeText(resumeText) {
    return Boolean(
      resumeText &&
      resumeText.trim() &&
      resumeText.trim() !== "Unable to extract resume text"
    );
  }

  function openTextResume(openedWindow, title, resumeText) {
    const safeTitle = title || "Resume";
    const escapedText = resumeText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    openedWindow.document.open();
    openedWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${safeTitle}</title>
        </head>
        <body style="margin:0;background:#f4f0e8;font-family:Georgia,serif;color:#1f2937;">
          <div style="max-width:900px;margin:32px auto;padding:28px;background:#fffdf8;border-radius:20px;box-shadow:0 20px 60px rgba(15,23,42,0.12);">
            <h1 style="margin:0 0 16px;font-size:24px;">${safeTitle}</h1>
            <pre style="white-space:pre-wrap;word-break:break-word;font-family:Georgia,serif;line-height:1.7;color:#374151;">${escapedText}</pre>
          </div>
        </body>
      </html>
    `);
    openedWindow.document.close();
  }

  async function viewResume(candidate) {
    if (!candidate?._id) {
      window.alert("This resume cannot be opened because its ID is missing.");
      return;
    }

    const openedWindow = window.open("", "_blank");

    if (!openedWindow) {
      window.alert("Popup blocked. Allow popups to view the resume.");
      return;
    }

    openedWindow.document.write("<p style=\"font-family: sans-serif; padding: 16px;\">Loading resume...</p>");

    setViewingId(candidate._id);

    try {
      let fullCandidate = candidate;

      try {
        fullCandidate = await fetchCandidateDetails(candidate._id);
      } catch (detailsError) {
        console.error("Candidate details fetch failed, using list data:", detailsError);
      }

      const isWordResume =
        fullCandidate.resumeMimeType === "application/msword" ||
        fullCandidate.resumeMimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (isWordResume && hasReadableResumeText(fullCandidate.resumeText)) {
        openTextResume(openedWindow, fullCandidate.name, fullCandidate.resumeText);
        return;
      }

      const fileUrl = `${API_BASE_URL}/candidates/${candidate._id}/file`;
      const res = await fetchWithAuth(fileUrl);

      if (!res.ok) {
        let errorMessage = "Resume file is not available for this candidate.";

        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Keep fallback.
        }

        throw new Error(errorMessage);
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      openedWindow.location.href = objectUrl;
    } catch (err) {
      console.error("Resume view failed:", err);
      if (hasReadableResumeText(candidate.resumeText)) {
        openTextResume(openedWindow, candidate.name, candidate.resumeText);
        return;
      }

      openedWindow.document.body.innerHTML = `
        <div style="font-family: sans-serif; padding: 16px;">
          <h2 style="margin-top: 0;">Unable to open resume</h2>
          <p>${err.message}</p>
          <p>This candidate needs to be uploaded again to restore the resume file.</p>
        </div>
      `;
      window.alert(`Failed to open resume: ${err.message}`);
    } finally {
      setViewingId(null);
    }
  }

  const userEmail = storedUser?.email || "";
  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : "U";

  if (!authToken) {
    return (
      <div className="app-shell">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Hirebud AI</p>
            <h1>
              {authMode === "login"
                ? "Sign in to your hiring workspace."
                : "Create your Hirebud AI account."}
            </h1>
            <p className="hero-copy">
              Access your pipelines, resumes, and candidate insights securely.
            </p>
          </div>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">
                  {authMode === "login" ? "Login" : "Sign up"}
                </p>
                <h2>
                  {authMode === "login"
                    ? "Welcome back"
                    : "Start screening smarter"}
                </h2>
              </div>
            </div>
            <form onSubmit={handleAuthSubmit}>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </label>
              {authMode === "signup" && (
                <label className="field">
                  <span>Confirm password</span>
                  <input
                    type="password"
                    value={authConfirm}
                    onChange={(event) => setAuthConfirm(event.target.value)}
                    placeholder="Re-enter password"
                    required
                  />
                </label>
              )}
              {authError && (
                <p className="helper-text weight-warning">{authError}</p>
              )}
              <div className="action-row">
                <button type="submit" className="primary-button" disabled={authLoading}>
                  {authLoading
                    ? "Please wait..."
                    : authMode === "login"
                      ? "Sign in"
                      : "Create account"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setAuthError("");
                  }}
                >
                  {authMode === "login" ? "Need an account?" : "Already have an account?"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-nav m-1">
        <div className="app-title left">Hirebud AI</div>
        <div className="app-title spacer" aria-hidden="true" />
        <div className="user-menu" ref={userMenuRef}>
          <button
            type="button"
            className="avatar-button"
            onClick={() => setUserMenuOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
          >
            {userInitial}
          </button>
          {userMenuOpen && (
            <div className="user-dropdown">
              <div className="user-email">{userEmail || "shobhit@gmail.com"}</div>
              <button type="button" className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Hirebud AI workspace</p>
          <h1>Group resumes, preview uploads, and review stronger candidate signals.</h1>
          <p className="hero-copy">
            Build role-based pipelines such as Digital Marketer or Content Creator,
            upload multiple resumes under one shared brief, and review fit scores with
            clearer remarks.
          </p>
        </div>
        <div className="hero-stats">
          <div>
            <span>Active filter</span>
            <strong>All candidates</strong>
          </div>
          <div>
            <span>Visible cards</span>
            <strong>{totalCandidatesShown}</strong>
          </div>
          <div>
            <span>Saved groups</span>
            <strong>{groups.length}</strong>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel panel-upload">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Upload</p>
              <h2>Upload resumes by group</h2>
            </div>
            <span className="candidate-chip neutral">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </span>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Group name</span>
              <input
                type="text"
                placeholder="Example: Digital Marketer"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>

            <div className="field">
              <span>Reuse existing group</span>
              <div className="group-pill-row">
                <button
                  type="button"
                  className={`group-pill ${groupName === "" ? "active" : ""}`}
                  onClick={() => {
                    setGroupName("");
                    setJob("");
                  }}
                >
                  New group
                </button>
                {groups.slice(0, 6).map((group) => (
                  <button
                    key={group.groupName}
                    type="button"
                    className={`group-pill ${groupName === group.groupName ? "active" : ""}`}
                    onClick={() => handleReuseGroupClick(group)}
                  >
                    {group.groupName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="field">
            <span>Common job description</span>
            <button
              type="button"
              className="secondary-button jd-generator-button"
              onClick={() => setIsJobGenOpen(true)}
            >
              Generate Job Description
            </button>
            <textarea
              placeholder="Paste the shared job description for this whole resume group"
              rows="6"
              value={job}
              onChange={(event) => setJob(event.target.value)}
            />
          </label>

          <div className="weights-panel">
            <div className="weights-header">
              <div>
                <p className="panel-kicker">Scoring weights</p>
                <h3>Customize how each section is scored</h3>
              </div>
              <div className="weights-header-actions">
                <span className={`weight-total ${weightsAreValid ? "ok" : "warn"}`}>
                  Total: {weightTotal}
                </span>
                <button
                  type="button"
                  className="weights-toggle"
                  onClick={() => setIsWeightsOpen((current) => !current)}
                >
                  {isWeightsOpen ? "Closed" : "Edit"}
                </button>
              </div>
            </div>
            {isWeightsOpen && (
              <>
                <div className="weights-grid">
                  <label className="field">
                    <span>Technical Skills</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreWeights.technicalSkills}
                      onChange={(event) =>
                        updateScoreWeight("technicalSkills", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Soft Skills</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreWeights.softwareSoftSkills}
                      onChange={(event) =>
                        updateScoreWeight("softwareSoftSkills", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Experience</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreWeights.experience}
                      onChange={(event) =>
                        updateScoreWeight("experience", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Projects</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreWeights.projects}
                      onChange={(event) =>
                        updateScoreWeight("projects", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Education / Certification</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreWeights.educationCertification}
                      onChange={(event) =>
                        updateScoreWeight("educationCertification", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="weights-actions">
                  <p className={`helper-text ${weightsAreValid ? "" : "weight-warning"}`}>
                    Total must equal 100 before you can upload.
                  </p>
                  <button type="button" onClick={resetScoreWeights} className="secondary-button">
                    Reset defaults
                  </button>
                </div>
              </>
            )}
          </div>

          <input
            id="resume-upload"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            className={`dropzone ${isDragActive ? "active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div>
              <p className="dropzone-title">Drag resumes here</p>
              <p className="dropzone-copy">
                PDF, DOC, DOCX, PNG, JPG, and JPEG are supported up to 10 MB each.
              </p>
            </div>
            <label htmlFor="resume-upload" className="primary-button">
              Choose files
            </label>
          </div>

          <p className="helper-text">{groupedPreviewHint}</p>

          {files.length > 0 && (
            <div className="preview-grid">
              {files.map((item) => (
                <PreviewCard key={item.id} item={item} onRemove={removeSelectedFile} />
              ))}
            </div>
          )}

          {uploadSummary && (
            <div className="status-card">
              <p>
                Uploaded successfully: <strong>{uploadSummary.uploadedCount}</strong>
                {uploadSummary.groupName ? ` into "${uploadSummary.groupName}"` : ""}
              </p>
              {uploadSummary.failedFiles.length > 0 && (
                <div className="status-errors">
                  {uploadSummary.failedFiles.map((item) => (
                    <p key={`${item.fileName}-${item.error}`}>
                      {item.fileName}: {item.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="action-row">
            <button
              type="button"
              onClick={uploadResumes}
              disabled={loading || !weightsAreValid}
              className="primary-button"
            >
              {loading ? "Uploading..." : "Upload group"}
            </button>
            <button
              type="button"
              onClick={clearSelectedFiles}
              disabled={files.length === 0}
              className="secondary-button"
            >
              Clear selection
            </button>
          </div>
        </div>

        <div className="panel panel-sidebar">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Saved groups</p>
              <h2>Hiring pipelines</h2>
            </div>
          </div>

          <select
            className="group-search-input"
            value={selectedGroupFilter}
            onChange={(event) => setSelectedGroupFilter(event.target.value)}
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group.groupName} value={group.groupName}>
                {group.groupName}
              </option>
            ))}
          </select>

          <div className="group-filter-list">
            <button
              type="button"
              className={`group-filter ${selectedGroupFilter === "" ? "active" : ""}`}
              onClick={() => setSelectedGroupFilter("")}
            >
              <span>All groups</span>
              <strong>{groups.reduce((count, group) => count + group.candidateCount, 0)}</strong>
            </button>
            {groups.map((group) => (
              <button
                key={group.groupName}
                type="button"
                className={`group-filter ${
                  selectedGroupFilter === group.groupName ? "active" : ""
                }`}
                onClick={() => setSelectedGroupFilter(group.groupName)}
              >
                <span>{group.groupName}</span>
                <strong>{group.candidateCount}</strong>
              </button>
            ))}
          </div>

          <div className="chat-panel">
            <p className="panel-kicker">Hirebud AI chat</p>
            <h3>Ask about {(selectedGroupFilter || "all groups").toLowerCase()}</h3>
            <input
              type="text"
              placeholder="Ask for the best-fit candidates or gaps"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button type="button" onClick={askChatbot} className="primary-button">
              Ask
            </button>
            <p className="chat-answer">{answer || "No answer yet."}</p>
          </div>
        </div>
      </section>

      <section className="results-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Recent activity</p>
              <h2>Latest candidates</h2>
            </div>
            <div className="results-toolbar">
              <span className="candidate-chip neutral">
                {selectedCandidateIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => setIsPdfOptionsOpen(true)}
                disabled={selectedCandidateIds.length === 0}
                className="primary-button"
              >
                Download PDF
              </button>
            </div>
          </div>
          <select
            className="candidate-search-input"
            value={candidateSearch}
            onChange={(event) => setCandidateSearch(event.target.value)}
          >
            <option value="">All candidate groups</option>
            {groups.map((group) => (
              <option key={group.groupName} value={group.groupName.toLowerCase()}>
                {group.groupName}
              </option>
            ))}
          </select>
          <select
            className="candidate-search-input"
            value={candidateSortOrder}
            onChange={(event) => setCandidateSortOrder(event.target.value)}
          >
            <option value="desc">Sort by final score: Highest first</option>
            <option value="asc">Sort by final score: Lowest first</option>
          </select>
          {sortedLatestCandidates.length === 0 ? (
            <p className="empty-state">No candidates available for this group yet.</p>
          ) : (
            sortedLatestCandidates.map((candidate) => (
              <CandidateCard
                key={candidate._id}
                candidate={candidate}
                deletingIds={deletingIds}
                viewingId={viewingId}
                onDelete={deleteCandidate}
                onView={viewResume}
                selected={selectedCandidateIds.includes(candidate._id)}
                onToggleSelect={toggleCandidateSelection}
                showDate={true}
              />
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Best matches</p>
              <h2>Top candidates</h2>
            </div>
          </div>
          {sortedTopCandidates.length === 0 ? (
            <p className="empty-state">No ranked candidates available yet.</p>
          ) : (
            sortedTopCandidates.map((candidate) => (
              <CandidateCard
                key={candidate._id}
                candidate={candidate}
                deletingIds={deletingIds}
                viewingId={viewingId}
                onDelete={deleteCandidate}
                onView={viewResume}
                selected={selectedCandidateIds.includes(candidate._id)}
                onToggleSelect={toggleCandidateSelection}
              />
            ))
          )}
        </div>
      </section>

      {isPdfOptionsOpen && (
        <div className="modal-backdrop" onClick={() => setIsPdfOptionsOpen(false)}>
          <div className="pdf-modal" onClick={(event) => event.stopPropagation()}>
            <p className="panel-kicker">PDF export</p>
            <h3>Choose fields to include</h3>
            <p className="pdf-modal-copy">
              Exporting {selectedCandidates.length} selected candidate{selectedCandidates.length === 1 ? "" : "s"}.
            </p>
            <label className="pdf-option">
              <input
                type="checkbox"
                checked={pdfFieldSelection.name}
                disabled={pdfFieldSelection.allDetails}
                onChange={() => updatePdfFieldSelection("name")}
              />
              <span>Name</span>
            </label>
            <label className="pdf-option">
              <input
                type="checkbox"
                checked={pdfFieldSelection.scoreDetails}
                disabled={pdfFieldSelection.allDetails}
                onChange={() => updatePdfFieldSelection("scoreDetails")}
              />
              <span>Score Details</span>
            </label>
            <label className="pdf-option">
              <input
                type="checkbox"
                checked={pdfFieldSelection.remarks}
                disabled={pdfFieldSelection.allDetails}
                onChange={() => updatePdfFieldSelection("remarks")}
              />
              <span>Remarks</span>
            </label>
            <label className="pdf-option">
              <input
                type="checkbox"
                checked={pdfFieldSelection.allDetails}
                onChange={() => updatePdfFieldSelection("allDetails")}
              />
              <span>All Details</span>
            </label>

            <div className="action-row">
              <button
                type="button"
                onClick={generateCandidatePdf}
                className="primary-button"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => setIsPdfOptionsOpen(false)}
                className="secondary-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isJobGenOpen && (
        <div className="modal-backdrop" onClick={() => setIsJobGenOpen(false)}>
          <div className="jobgen-modal" onClick={(event) => event.stopPropagation()}>
            <div className="jobgen-header">
              <div>
                <p className="panel-kicker">Job description generator</p>
                <h3>Generate a structured job description</h3>
              </div>
            </div>

            <div className="jobgen-body">
              <section className="jobgen-section">
                <h4>Role Basics</h4>
                <label className="field">
                  <span>Job Title *</span>
                  <input
                    type="text"
                    value={jobGenData.title}
                    onChange={(event) => updateJobGenField("title", event.target.value)}
                  />
                  {jobGenErrors.title && (
                    <p className="helper-text weight-warning">{jobGenErrors.title}</p>
                  )}
                </label>
                <label className="field">
                  <span>Job Level / Seniority *</span>
                  <select
                    className="candidate-search-input"
                    value={jobGenData.level}
                    onChange={(event) => updateJobGenField("level", event.target.value)}
                  >
                    <option value="">Select level</option>
                    <option value="Intern">Intern</option>
                    <option value="Entry-Level / Junior">Entry-Level / Junior</option>
                    <option value="Mid-Level">Mid-Level</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead / Staff">Lead / Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Director / Head">Director / Head</option>
                    <option value="VP / C-level">VP / C-level</option>
                    <option value="Other">Other</option>
                  </select>
                  {jobGenErrors.level && (
                    <p className="helper-text weight-warning">{jobGenErrors.level}</p>
                  )}
                </label>
                <label className="field">
                  <span>Employment Type *</span>
                  <select
                    className="candidate-search-input"
                    value={jobGenData.employmentType}
                    onChange={(event) => updateJobGenField("employmentType", event.target.value)}
                  >
                    <option value="">Select type</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract / Freelance">Contract / Freelance</option>
                    <option value="Internship">Internship</option>
                  </select>
                  {jobGenErrors.employmentType && (
                    <p className="helper-text weight-warning">
                      {jobGenErrors.employmentType}
                    </p>
                  )}
                </label>
              </section>

              <section className="jobgen-section">
                <h4>Location & Schedule</h4>
                <label className="field">
                  <span>Work Arrangement *</span>
                  <select
                    className="candidate-search-input"
                    value={jobGenData.workArrangement}
                    onChange={(event) => updateJobGenField("workArrangement", event.target.value)}
                  >
                    <option value="">Select arrangement</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                  {jobGenErrors.workArrangement && (
                    <p className="helper-text weight-warning">
                      {jobGenErrors.workArrangement}
                    </p>
                  )}
                </label>
                <label className="field">
                  <span>Office Location *</span>
                  <input
                    type="text"
                    placeholder="e.g. Chennai, Tamil Nadu"
                    value={jobGenData.location}
                    onChange={(event) => updateJobGenField("location", event.target.value)}
                  />
                  {jobGenErrors.location && (
                    <p className="helper-text weight-warning">{jobGenErrors.location}</p>
                  )}
                </label>
                <label className="field">
                  <span>Timezone / Working hours overlap</span>
                  <input
                    type="text"
                    value={jobGenData.timezone}
                    onChange={(event) => updateJobGenField("timezone", event.target.value)}
                  />
                </label>
              </section>

              <section className="jobgen-section">
                <h4>Responsibilities</h4>
                <label className="field">
                  <span>Main responsibilities *</span>
                  <textarea
                    rows="5"
                    placeholder="Use bullet points"
                    value={jobGenData.responsibilities}
                    onChange={(event) => updateJobGenField("responsibilities", event.target.value)}
                  />
                  {jobGenErrors.responsibilities && (
                    <p className="helper-text weight-warning">
                      {jobGenErrors.responsibilities}
                    </p>
                  )}
                </label>
                <label className="field">
                  <span>Primary goal or biggest impact expected</span>
                  <textarea
                    rows="3"
                    value={jobGenData.impact}
                    onChange={(event) => updateJobGenField("impact", event.target.value)}
                  />
                </label>
              </section>

              <section className="jobgen-section">
                <h4>Requirements</h4>
                <label className="field">
                  <span>Must-have skills / technologies *</span>
                  <textarea
                    rows="4"
                    value={jobGenData.mustHave}
                    onChange={(event) => updateJobGenField("mustHave", event.target.value)}
                  />
                  {jobGenErrors.mustHave && (
                    <p className="helper-text weight-warning">{jobGenErrors.mustHave}</p>
                  )}
                </label>
                <label className="field">
                  <span>Nice-to-have skills</span>
                  <textarea
                    rows="3"
                    value={jobGenData.niceToHave}
                    onChange={(event) => updateJobGenField("niceToHave", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Minimum years of experience</span>
                  <select
                    className="candidate-search-input"
                    value={jobGenData.experience}
                    onChange={(event) => updateJobGenField("experience", event.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="No minimum">No minimum</option>
                    <option value="1–2 years">1–2 years</option>
                    <option value="3–5 years">3–5 years</option>
                    <option value="5–8 years">5–8 years</option>
                    <option value="8+ years">8+ years</option>
                  </select>
                </label>
                <label className="field">
                  <span>Education / certifications</span>
                  <textarea
                    rows="3"
                    value={jobGenData.education}
                    onChange={(event) => updateJobGenField("education", event.target.value)}
                  />
                </label>
              </section>

              <section className="jobgen-section">
                <h4>Scoring Priorities</h4>
                <div className="jobgen-priority-grid">
                  {[
                    "technicalSkills",
                    "softwareSoftSkills",
                    "experience",
                    "projects",
                    "educationCertification"
                  ].map((key, index) => (
                    <label className="field" key={`priority-${index}`}>
                      <span>Priority {index + 1}</span>
                      <select
                        className="candidate-search-input"
                        value={jobGenData.priorities?.[index] || key}
                        onChange={(event) => updatePriority(index, event.target.value)}
                      >
                        <option value="technicalSkills">Technical Skills</option>
                        <option value="softwareSoftSkills">Soft Skills</option>
                        <option value="experience">Experience</option>
                        <option value="projects">Projects</option>
                        <option value="educationCertification">
                          Education / Certifications
                        </option>
                      </select>
                    </label>
                  ))}
                </div>
              </section>

              <section className="jobgen-section">
                <h4>Compensation & Benefits</h4>
                <label className="field">
                  <span>Salary range</span>
                  <input
                    type="text"
                    value={jobGenData.salaryRange}
                    onChange={(event) => updateJobGenField("salaryRange", event.target.value)}
                  />
                </label>
                <div className="jobgen-checkboxes">
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.health}
                      onChange={(event) => updateBenefit("health", event.target.checked)}
                    />
                    <span>Health insurance</span>
                  </label>
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.equity}
                      onChange={(event) => updateBenefit("equity", event.target.checked)}
                    />
                    <span>Stock options / ESOP</span>
                  </label>
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.remoteStipend}
                      onChange={(event) => updateBenefit("remoteStipend", event.target.checked)}
                    />
                    <span>Remote work stipend</span>
                  </label>
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.learningBudget}
                      onChange={(event) => updateBenefit("learningBudget", event.target.checked)}
                    />
                    <span>Learning budget</span>
                  </label>
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.flexibleHours}
                      onChange={(event) => updateBenefit("flexibleHours", event.target.checked)}
                    />
                    <span>Flexible hours</span>
                  </label>
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.pto}
                      onChange={(event) => updateBenefit("pto", event.target.checked)}
                    />
                    <span>Paid time off</span>
                  </label>
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.wfhEquipment}
                      onChange={(event) => updateBenefit("wfhEquipment", event.target.checked)}
                    />
                    <span>Work-from-home equipment</span>
                  </label>
                  <label className="candidate-select-row">
                    <input
                      type="checkbox"
                      checked={jobGenData.benefits.bonus}
                      onChange={(event) => updateBenefit("bonus", event.target.checked)}
                    />
                    <span>Performance bonus</span>
                  </label>
                </div>
                <label className="field">
                  <span>Other (optional)</span>
                  <input
                    type="text"
                    value={jobGenData.benefitsOther}
                    onChange={(event) => updateJobGenField("benefitsOther", event.target.value)}
                  />
                </label>
              </section>

              <section className="jobgen-section">
                <h4>Company & Culture</h4>
                <label className="field">
                  <span>Company description / mission</span>
                  <textarea
                    rows="4"
                    value={jobGenData.companyDescription}
                    onChange={(event) =>
                      updateJobGenField("companyDescription", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>What makes this role exciting</span>
                  <textarea
                    rows="3"
                    value={jobGenData.roleExcitement}
                    onChange={(event) =>
                      updateJobGenField("roleExcitement", event.target.value)
                    }
                  />
                </label>
              </section>

              <section className="jobgen-section">
                <h4>Preview</h4>
                <textarea
                  className="jobgen-preview"
                  rows="10"
                  value={generatedJobDesc}
                  onChange={(event) => setGeneratedJobDesc(event.target.value)}
                  placeholder="Generated job description will appear here."
                />
                <div className="action-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCopyJobDescription}
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleUseJobDescription}
                  >
                    Confirm
                  </button>
                </div>
              </section>
            </div>

            <div className="action-row jobgen-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsJobGenOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleGenerateJobDescription}
              >
                Generate Job Description
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
