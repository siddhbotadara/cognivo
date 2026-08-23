import { GoogleGenAI } from "@google/genai";
import { TTS_MODELS, DEFAULT_TTS_MODEL, TONE_STYLE } from "../config/ttsConfig.js";

// ── Self-contained daily quota tracker (independent of quotaManager.js —
// see note in the write-up about why). Same DAY_MS pattern you already use.
const DAY_MS = 24 * 60 * 60 * 1000;
const ttsUsage = new Map(); // userId -> Map<modelId, timestamps[]>

function cleanOld(timestamps) {
  const cutoff = Date.now() - DAY_MS;
  return timestamps.filter((ts) => ts > cutoff);
}

function consumeTts(userId, modelKey) {
  if (!ttsUsage.has(userId)) ttsUsage.set(userId, new Map());
  const byModel = ttsUsage.get(userId);
  const tier = TTS_MODELS[modelKey];
  const timestamps = cleanOld(byModel.get(modelKey) || []);
  if (timestamps.length >= tier.dailyLimit) {
    byModel.set(modelKey, timestamps);
    return { allowed: false, remaining: 0 };
  }
  timestamps.push(Date.now());
  byModel.set(modelKey, timestamps);
  return { allowed: true, remaining: tier.dailyLimit - timestamps.length };
}

export function getTtsStats(userId) {
  return Object.values(TTS_MODELS).map((tier) => {
    const used = cleanOld(ttsUsage.get(userId)?.get(tier.id) || []).length;
    return {
      id: tier.id,
      label: tier.label,
      limit: tier.dailyLimit,
      used,
      remaining: Math.max(0, tier.dailyLimit - used),
    };
  });
}

// ── Build the style-directed prompt from your speakerSegments shape
// (same { speaker, text, tone } shape gemini.service.js already returns).
function buildPrompt(segments, languageLabel) {
  const clean = (segments || []).filter((s) => s?.text?.trim());
  const speakers = [...new Set(clean.map((s) => s.speaker || "Narrator"))];
  const languageLine =
    languageLabel && languageLabel !== "Auto" ? `Speak in ${languageLabel}. ` : "";

  // Single speaker / plain narration
  if (speakers.length <= 1) {
    const tone = clean[0]?.tone || "neutral";
    const style = TONE_STYLE[tone] || TONE_STYLE.neutral;
    const text = clean.map((s) => s.text).join(" ");
    return {
      mode: "single",
      promptText: `${languageLine}Read the following aloud like a calm, encouraging teacher, speaking ${style}, with natural breathing pauses between sentences:\n\n${text}`,
      speakers: ["Narrator"],
    };
  }

  // Multi-speaker — Gemini TTS only supports 2 voice slots, so cap at the
  // two most frequent speakers and fold the rest into the second voice
  // (same idea as the "Team Member" merge you already do in gemini.service.js).
  const counts = {};
  clean.forEach((s) => (counts[s.speaker || "Narrator"] = (counts[s.speaker || "Narrator"] || 0) + 1));
  const [primary, secondary] = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const remap = (name) => (name === primary ? primary : secondary || primary);

  const toneFor = {};
  clean.forEach((s) => {
    const who = remap(s.speaker || "Narrator");
    if (!toneFor[who]) toneFor[who] = s.tone || "neutral";
  });

  const directive = Object.entries(toneFor)
    .map(([speaker, tone]) => `make ${speaker} sound ${TONE_STYLE[tone] || TONE_STYLE.neutral}`)
    .join(", and ");

  const transcript = clean.map((s) => `${remap(s.speaker || "Narrator")}: ${s.text}`).join("\n");

  return {
    mode: "multi",
    promptText: `${languageLine}${directive}:\n\n${transcript}`,
    speakers: [primary, secondary].filter(Boolean),
  };
}

// ── Gemini TTS returns raw 16-bit PCM @ 24kHz mono — browsers can't play
// that without a WAV/RIFF header, so wrap it before sending to the frontend.
function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

// ── Estimated per-word timing for the karaoke-style highlight. Gemini TTS
// does not return word/phoneme timestamps, so this spreads time across the
// real decoded audio duration, weighted by word length + punctuation pauses.
// It's an estimate, not forced alignment — same approach most read-aloud
// tools use when the TTS vendor doesn't expose timing marks.
function estimateWordTimings(fullText, durationSec) {
  const words = fullText.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const weights = words.map((w) => w.length + (/[,.;:!?]$/.test(w) ? 3 : 0) + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = 0;
  return words.map((word) => {
    const w = word.length + (/[,.;:!?]$/.test(word) ? 3 : 0) + 1;
    const dur = (w / total) * durationSec;
    const start = t;
    t += dur;
    return { word, start: +start.toFixed(3), end: +t.toFixed(3) };
  });
}

export async function synthesizeModule({
  userId,
  segments,
  languageCode = "auto",
  languageLabel = "Auto",
  ttsModel = DEFAULT_TTS_MODEL,
}) {
  const tier = TTS_MODELS[ttsModel] || TTS_MODELS[DEFAULT_TTS_MODEL];
  const quota = consumeTts(userId || "anonymous", tier.id);
  if (!quota.allowed) {
    const err = new Error(`Daily limit reached for ${tier.label} (10/day). Try the other model or again tomorrow.`);
    err.code = "TTS_QUOTA_EXCEEDED";
    throw err;
  }

  const apiKey = process.env.GEMINI_FINAL_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const { promptText, mode, speakers } = buildPrompt(segments, languageLabel);

  const speechConfig =
    mode === "multi"
      ? {
          ...(languageCode !== "auto" ? { languageCode } : {}),
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: speakers[0], voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
              { speaker: speakers[1] || speakers[0], voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
            ],
          },
        }
      : {
          ...(languageCode !== "auto" ? { languageCode } : {}),
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        };

  const response = await ai.models.generateContent({
    model: tier.model,
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    config: { responseModalities: ["AUDIO"], speechConfig },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p) =>
    p.inlineData?.mimeType?.startsWith("audio/")
  );
  if (!part) throw new Error("Gemini TTS returned no audio");

  const pcm = Buffer.from(part.inlineData.data, "base64");
  const wav = pcmToWav(pcm, 24000, 1, 16);
  const durationSec = pcm.length / 2 / 24000; // 16-bit mono @ 24kHz

  const fullText = (segments || []).map((s) => s.text).join(" ");
  const words = estimateWordTimings(fullText, durationSec);

  return {
    audioBase64: wav.toString("base64"),
    mimeType: "audio/wav",
    durationSec: +durationSec.toFixed(2),
    words,
    modelInfo: { tier: tier.id, label: tier.label, remaining: quota.remaining },
  };
}