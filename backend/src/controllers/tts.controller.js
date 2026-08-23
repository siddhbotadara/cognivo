import { synthesizeModule, getTtsStats } from "../services/tts.service.js";
import { TTS_MODELS, LANGUAGES } from "../config/ttsConfig.js";

export async function handleSynthesize(request, reply) {
  try {
    const { userId, segments, moduleText, languageCode, ttsModel } = request.body || {};

    const finalSegments = Array.isArray(segments) && segments.length
      ? segments
      : moduleText
      ? [{ speaker: "Narrator", text: moduleText, tone: "neutral" }]
      : null;

    if (!finalSegments) {
      return reply.code(400).send({ error: "Provide either 'segments' or 'moduleText'" });
    }

    const lang = LANGUAGES.find((l) => l.code === languageCode) || LANGUAGES[0];

    const result = await synthesizeModule({
      userId,
      segments: finalSegments,
      languageCode: lang.code,
      languageLabel: lang.label,
      ttsModel,
    });

    return reply.send(result);
  } catch (err) {
    request.log.error(err);
    if (err.code === "TTS_QUOTA_EXCEEDED") {
      return reply.code(429).send({ error: err.message });
    }
    return reply.code(500).send({ error: "Failed to synthesize audio" });
  }
}

export async function handleTtsQuota(request, reply) {
  return reply.send({ tiers: getTtsStats(request.params.profileId) });
}

export async function handleTtsOptions(_request, reply) {
  return reply.send({ models: Object.values(TTS_MODELS), languages: LANGUAGES });
}