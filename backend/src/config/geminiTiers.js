export const TIERS = [
  {
    id: "ultra",
    label: "Cognivo Ultra",
    model: "gemini-3.7-flash",
    dailyLimit: 3,
    description: "Newest, most capable model. Very limited per day.",
  },
  {
    id: "pro",
    label: "Cognivo Pro",
    model: "gemini-3.6-flash",
    dailyLimit: 4,
    description: "Strong general-purpose model. A few uses per day.",
  },
  {
    id: "plus",
    label: "Cognivo Plus",
    model: "gemini-3.5-flash",
    dailyLimit: 5,
    description: "Solid everyday model, higher daily allowance.",
  },
  {
    id: "lite",
    label: "Cognivo Lite",
    model: "gemini-3.5-flash-lite",
    dailyLimit: 100,
    description: "High-volume fallback. Practically never runs out.",
  },
];

export const TIER_ORDER = TIERS.map((t) => t.id);
export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));
export const DEFAULT_TIER = "pro";

// Model used for the post-explanation comprehension quiz. Deliberately
// separate from the TIERS list above — quiz generation isn't one of the
// 4 user-facing tiers, it's a fixed internal model with its own quota
// bucket (see "quiz" in getFeatureKey/FEATURE_KEYS below), so it never
// touches the ultra/pro/plus/lite counters shown in the frontend.
export const QUIZ_MODEL = "gemini-3.1-flash-lite";

export function getFeatureKey(feature) {
  const envVarByFeature = {
    core: process.env.GEMINI_SIDDH_API_1,
    diagram: process.env.GEMINI_SIDDH_API_1,
    live: process.env.GEMINI_SIDDH_API_1,
    quiz: process.env.GEMINI_SIDDH_API_1,
  };
  return envVarByFeature[feature];
}

// Kept for anything still importing FEATURE_KEYS directly — same caveat
// applies to this one (eager), so prefer getFeatureKey() in new code.
export const FEATURE_KEYS = {
  core: process.env.GEMINI_SIDDH_API_1,
  diagram: process.env.GEMINI_SIDDH_API_1,
  live: process.env.GEMINI_SIDDH_API_1,
  quiz: process.env.GEMINI_SIDDH_API_1,
};

export function resolveTier(requestedTierId) {
  return TIER_BY_ID[requestedTierId] || TIER_BY_ID[DEFAULT_TIER];
}