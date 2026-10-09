import {
  TIERS,
  TIER_ORDER,
  TIER_BY_ID,
  getFeatureKey,
  DEFAULT_TIER,
} from "../config/geminiTiers.js";

// usage shape:
// Map<userId, Map<feature, Map<tierId, Array<{ id: string, timestamp: number, dayKey: string }>>>>
// Each request gets its own reservation id so a failed concurrent request
// refunds exactly its own reservation instead of popping another request's token.
const usage = new Map();

// Global model health for the running backend process.
// A successful request resets consecutive 502/503 failures for that model.
const globalTierHealth = new Map();

// User-specific 60-second cooldowns after a 502/503 for that tier.
const userCooldowns = new Map();

const DEFAULT_COOLDOWN_SECONDS = 60;
const QUOTA_TIME_ZONE = process.env.QUOTA_TIME_ZONE || "UTC";

function getTodayString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getTierHealth(feature, tierId) {
  const today = getTodayString();

  const healthKey = `${feature}:${tierId}`;

  if (!globalTierHealth.has(healthKey)) {
    globalTierHealth.set(healthKey, {
      consecutiveFails: 0,
      lockedToday: false,
      lockDate: today,
      lockReason: null,
    });
  }

  const health = globalTierHealth.get(healthKey);

  if (health.lockDate !== today) {
    health.consecutiveFails = 0;
    health.lockedToday = false;
    health.lockDate = today;
    health.lockReason = null;
  }

  return health;
}

function cleanOldReservations(reservations = []) {
  const today = getTodayString();
  return reservations.filter((reservation) => reservation.dayKey === today);
}

function getBucket(userId, feature) {
  if (!usage.has(userId)) {
    usage.set(userId, new Map());
  }

  const byFeature = usage.get(userId);

  if (!byFeature.has(feature)) {
    const tierMap = new Map(TIER_ORDER.map((id) => [id, []]));
    byFeature.set(feature, tierMap);
  }

  return byFeature.get(feature);
}

function getUserCooldownSeconds(userId, tierId) {
  const userMap = userCooldowns.get(userId);
  if (!userMap) return 0;

  const expiresAt = userMap.get(tierId) || 0;
  const remaining = Math.ceil((expiresAt - Date.now()) / 1000);

  if (remaining <= 0) {
    userMap.delete(tierId);
    return 0;
  }

  return remaining;
}

function setUserCooldown(userId, tierId, seconds = DEFAULT_COOLDOWN_SECONDS) {
  if (!userCooldowns.has(userId)) {
    userCooldowns.set(userId, new Map());
  }

  userCooldowns.get(userId).set(tierId, Date.now() + seconds * 1000);
}

function createQuotaError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function consume(userId, feature, requestedTierId = DEFAULT_TIER) {
  const tierId = requestedTierId || DEFAULT_TIER;
  const tier = TIER_BY_ID[tierId];

  if (!tier) {
    throw createQuotaError(
      "INVALID_TIER",
      `Unknown Cognivo model tier: ${tierId}`,
      { requestedTier: tierId }
    );
  }

  const health = getTierHealth(feature, tierId);

  // A global lock applies to every current and new user until the daily reset.
  if (health.lockedToday) {
    throw createQuotaError(
      "MODEL_LOCKED_TODAY",
      health.lockReason === "PROVIDER_QUOTA_EXHAUSTED"
        ? `${tier.label} is unavailable today because its Gemini API allowance has been exhausted.`
        : `${tier.label} is currently unavailable today because Gemini has repeatedly returned service-unavailable errors.`,
      {
        requestedTier: tierId,
        tierId,
        lockReason: health.lockReason,
      }
    );
  }

  const cooldownSeconds = getUserCooldownSeconds(userId, tierId);
  if (cooldownSeconds > 0) {
    throw createQuotaError(
      "MODEL_COOLDOWN",
      `${tier.label} is on cooldown for ${cooldownSeconds} seconds.`,
      {
        requestedTier: tierId,
        tierId,
        cooldownSeconds,
      }
    );
  }

  const bucket = getBucket(userId, feature);
  const reservations = cleanOldReservations(bucket.get(tierId) || []);
  bucket.set(tierId, reservations);

  // IMPORTANT: no automatic downgrade.
  // The user's selected model either has an available app-side token or it does not.
  if (reservations.length >= tier.dailyLimit) {
    throw createQuotaError(
      "MODEL_QUOTA_EXHAUSTED",
      `${tier.label} has reached its daily Cognivo limit.`,
      {
        requestedTier: tierId,
        tierId,
        limit: tier.dailyLimit,
      }
    );
  }

  const reservation = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: Date.now(),
    dayKey: getTodayString(),
  };

  reservations.push(reservation);

  return {
    reservationId: reservation.id,
    approvedTier: tierId,
    label: tier.label,
    model: tier.model,
    remaining: Math.max(0, tier.dailyLimit - reservations.length),
    downgraded: false,
    requestedTier: tierId,
  };
}

function refund(userId, feature, tierId, reservationId) {
  const bucket = getBucket(userId, feature);
  const reservations = bucket.get(tierId);

  if (!reservations?.length) return false;

  let removeIndex = -1;

  if (reservationId) {
    removeIndex = reservations.findIndex((item) => item.id === reservationId);
  }

  // Backward-safe fallback for older callers that do not pass a reservation id.
  if (removeIndex === -1 && !reservationId) {
    removeIndex = reservations.length - 1;
  }

  if (removeIndex === -1) return false;

  reservations.splice(removeIndex, 1);
  return true;
}

function recordFailure(
  userId,
  tierId,
  feature = "core",
  reservationId,
  cooldownSeconds = DEFAULT_COOLDOWN_SECONDS
) {
  // The user did not receive a successful model response, so give the app token back.
  refund(userId, feature, tierId, reservationId);

  // Prevent immediate repeated attempts from the same user/model.
  setUserCooldown(userId, tierId, cooldownSeconds);

  const health = getTierHealth(feature, tierId);
  health.consecutiveFails += 1;

  if (health.consecutiveFails >= 3) {
    health.lockedToday = true;
    health.lockReason = "SERVICE_UNAVAILABLE";
  }

  return {
    lockedToday: health.lockedToday,
    consecutiveFails: health.consecutiveFails,
    lockReason: health.lockReason,
  };
}

function recordProviderQuotaExhausted(userId, tierId, feature = "core", reservationId) {
  // Provider quota exhaustion also means the user did not get an answer.
  refund(userId, feature, tierId, reservationId);

  const health = getTierHealth(feature, tierId);
  health.lockedToday = true;
  health.lockReason = "PROVIDER_QUOTA_EXHAUSTED";

  return {
    lockedToday: true,
    consecutiveFails: health.consecutiveFails,
    lockReason: health.lockReason,
  };
}

function recordSuccess(tierId, feature = "core") {
  const health = getTierHealth(feature, tierId);
  health.consecutiveFails = 0;
}

function getKey(feature = "core") {
  const key = getFeatureKey(feature);

  if (!key) {
    throw new Error(
      `quotaManager.getKey(): no API key configured for feature "${feature}". Check your .env and config/geminiTiers.js getFeatureKey().`
    );
  }

  console.log(
    `🔑 quotaManager: feature="${feature}" using key ending in …${key.slice(-4)}`
  );

  return key;
}

function selectModel(userId, feature, requestedTierId = DEFAULT_TIER) {
  const resolvedUserId = userId || "anonymous";

  // Get the key first so a missing configuration never burns a user token.
  const apiKey = getKey(feature);
  const result = consume(resolvedUserId, feature, requestedTierId);

  return { ...result, apiKey };
}

function getStats(userId, feature = "core") {
  const resolvedUserId = userId || "anonymous";
  const bucket = getBucket(resolvedUserId, feature);

  return TIERS.map((tier) => {
    const health = getTierHealth(feature, tier.id);
    const reservations = cleanOldReservations(bucket.get(tier.id) || []);
    bucket.set(tier.id, reservations);

    const used = reservations.length;
    const remaining = Math.max(0, tier.dailyLimit - used);
    const cooldownSeconds = getUserCooldownSeconds(resolvedUserId, tier.id);

    return {
      id: tier.id,
      label: tier.label,
      limit: tier.dailyLimit,
      used,
      remaining,
      cooldownSeconds,
      isLockedToday: health.lockedToday,
      lockReason: health.lockReason,
      isExhausted: remaining <= 0,
    };
  });
}

export const quotaManager = {
  getKey,
  selectModel,
  refund,
  recordFailure,
  recordProviderQuotaExhausted,
  recordSuccess,
  getStats,
  getUserCooldownSeconds,
};

export const checkAndConsumeQuota = (userId, requestedTier, feature = "core") =>
  consume(userId, feature, requestedTier);

export const getUserQuotaStats = (userId, feature = "core") =>
  getStats(userId, feature);
