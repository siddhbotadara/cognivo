import { quotaManager } from "../utils/quotaManager.js";

// GET /quota/:profileId?feature=core
export async function getQuota(request, reply) {
  try {
    const { profileId } = request.params;

    if (!profileId) {
      return reply.code(400).send({
        error: "profileId is required"
      });
    }

    // "core" = main analysis + context query, "diagram" = mermaid agent.
    // Matches the feature names in config/geminiTiers.js FEATURE_KEYS.
    const feature = request.query?.feature || "core";

    const tiers = quotaManager.getStats(profileId, feature);

    return reply.send({ feature, tiers });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      error: "Failed to fetch quota"
    });
  }
}