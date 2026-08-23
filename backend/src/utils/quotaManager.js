import { TIERS, TIER_ORDER, TIER_BY_ID, getFeatureKey, DEFAULT_TIER } from "../config/geminiTiers.js";

// usage shape: Map<userId, Map<feature, Map<tierId, number[] timestamps>>>
const usage = new Map();

const DAY_MS = 24 * 60 * 60 * 1000;

function cleanOldTimestamps(timestamps) {
  const cutoff = Date.now() - DAY_MS;
  return timestamps.filter((ts) => ts > cutoff);
}

function getBucket(userId, feature) {
  if (!usage.has(userId)) usage.set(userId, new Map());
  const byFeature = usage.get(userId);

  if (!byFeature.has(feature)) {
    const tierMap = new Map(TIER_ORDER.map((id) => [id, []]));
    byFeature.set(feature, tierMap);
  }
  return byFeature.get(feature);
}

function consume(userId, feature, requestedTierId) {
  const startIndex = TIER_ORDER.indexOf(requestedTierId);
  const bucket = getBucket(userId, feature);

  const searchOrder = startIndex === -1 ? TIER_ORDER : TIER_ORDER.slice(startIndex);

  for (const tierId of searchOrder) {
    const tier = TIER_BY_ID[tierId];
    const timestamps = cleanOldTimestamps(bucket.get(tierId));
    bucket.set(tierId, timestamps);

    if (timestamps.length < tier.dailyLimit) {
      timestamps.push(Date.now());
      return {
        approvedTier: tierId,
        label: tier.label,
        model: tier.model,
        remaining: tier.dailyLimit - timestamps.length,
        downgraded: tierId !== requestedTierId,
        requestedTier: requestedTierId,
      };
    }
  }

  const fallback = TIER_BY_ID[TIER_ORDER[TIER_ORDER.length - 1]];
  return {
    approvedTier: fallback.id,
    label: fallback.label,
    model: fallback.model,
    remaining: 0,
    downgraded: true,
    requestedTier: requestedTierId,
    exhausted: true,
  };
}

function getKey(feature = "core") {
  const key = getFeatureKey(feature);
  if (!key) {
    throw new Error(
      `quotaManager.getKey(): no API key configured for feature "${feature}". Check your .env and config/geminiTiers.js getFeatureKey().`
    );
  }

  console.log(`🔑 quotaManager: feature="${feature}" using key ending in …${key.slice(-4)}`);
  return key;
}

function selectModel(userId, feature, requestedTierId = DEFAULT_TIER) {
  const result = consume(userId || "anonymous", feature, requestedTierId);
  return { ...result, apiKey: getKey(feature) };
}

function getStats(userId, feature = "core") {
  const bucket = getBucket(userId || "anonymous", feature);
  return TIERS.map((tier) => {
    const used = cleanOldTimestamps(bucket.get(tier.id)).length;
    return {
      id: tier.id,
      label: tier.label,
      limit: tier.dailyLimit,
      used,
      remaining: Math.max(0, tier.dailyLimit - used),
    };
  });
}

export const quotaManager = {
  getKey,
  selectModel,
  getStats,
};

export const checkAndConsumeQuota = (userId, requestedTier, feature = "core") =>
  consume(userId, feature, requestedTier);
export const getUserQuotaStats = (userId, feature = "core") => getStats(userId, feature);