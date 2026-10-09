import { GoogleGenAI } from "@google/genai";
import { TTS_MODELS, DEFAULT_TTS_MODEL, TONE_STYLE } from "../config/ttsConfig.js";

// ── Daily quota tracker ──────────────────────────────────────────────
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

// Give the quota back if generation failed (user shouldn't pay for errors)
function refundTts(userId, modelKey) {
  const byModel = ttsUsage.get(userId);
  if (!byModel) return;
  const timestamps = byModel.get(modelKey) || [];
  timestamps.pop();
  byModel.set(modelKey, timestamps);
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

// ── Prompt builders ──────────────────────────────────────────────────
// "structured": profile / scene / director's notes / TRANSCRIPT marker.
//   Only text after the TRANSCRIPT marker is meant to be spoken.
// "inline": classic "Say <style>: text" format (fallback for models that
//   behave better with it). Switch per model via `promptStyle` in ttsConfig.
function buildPrompt(segments, languageLabel, promptStyle = "structured") {
  const clean = (segments || []).filter((s) => s?.text?.trim());
  const speakers = [...new Set(clean.map((s) => s.speaker || "Narrator"))];
  const hasLanguage = languageLabel && languageLabel !== "Auto";

  // ---------- Single speaker ----------
  if (speakers.length <= 1) {
    const tone = clean[0]?.tone || "neutral";
    const style = TONE_STYLE[tone] || TONE_STYLE.neutral;
    const text = clean.map((s) => s.text).join(" ");

    if (promptStyle === "inline") {
      return {
        mode: "single",
        promptText: `Say ${style}${hasLanguage ? `, in ${languageLabel}` : ""}: ${text}`,
        speakers: ["Narrator"],
      };
    }

    return {
      mode: "single",
      promptText: [
        "# AUDIO PROFILE",
        "Narrator, a calm, encouraging teacher.",
        "",
        "## THE SCENE",
        "A quiet one-to-one tutoring session.",
        "",
        "### DIRECTOR'S NOTES",
        `Style: ${style}.`,
        "Pacing: natural, with breathing pauses between sentences.",
        hasLanguage ? `Language: ${languageLabel}.` : null,
        "",
        "#### TRANSCRIPT",
        text,
      ]
        .filter((l) => l !== null)
        .join("\n"),
      speakers: ["Narrator"],
    };
  }

  // ---------- Multi speaker (Gemini supports 2 voice slots) ----------
  const counts = {};
  clean.forEach((s) => {
    const n = s.speaker || "Narrator";
    counts[n] = (counts[n] || 0) + 1;
  });
  const [primary, secondary] = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const remap = (name) => (name === primary ? primary : secondary || primary);

  const toneFor = {};
  clean.forEach((s) => {
    const who = remap(s.speaker || "Narrator");
    if (!toneFor[who]) toneFor[who] = s.tone || "neutral";
  });

  const transcript = clean
    .map((s) => `${remap(s.speaker || "Narrator")}: ${s.text}`)
    .join("\n");

  if (promptStyle === "inline") {
    const directive = Object.entries(toneFor)
      .map(([sp, tone]) => `make ${sp} sound ${TONE_STYLE[tone] || TONE_STYLE.neutral}`)
      .join(", and ");
    return {
      mode: "multi",
      promptText: `${directive}${hasLanguage ? `, speaking ${languageLabel}` : ""}:\n\n${transcript}`,
      speakers: [primary, secondary].filter(Boolean),
    };
  }

  const profile = Object.keys(toneFor)
    .map((sp) => `${sp}: a natural conversational speaker.`)
    .join("\n");
  const notes = Object.entries(toneFor)
    .map(([sp, tone]) => `${sp}: ${TONE_STYLE[tone] || TONE_STYLE.neutral}.`)
    .join("\n");

  return {
    mode: "multi",
    promptText: [
      "# AUDIO PROFILE",
      profile,
      "",
      "## THE SCENE",
      "A relaxed, natural conversation.",
      "",
      "### DIRECTOR'S NOTES",
      notes,
      "Pacing: natural turn-taking with brief pauses between speakers.",
      hasLanguage ? `Language: ${languageLabel}.` : null,
      "",
      "#### TRANSCRIPT",
      transcript,
    ]
      .filter((l) => l !== null)
      .join("\n"),
    speakers: [primary, secondary].filter(Boolean),
  };
}

// ── PCM cleanup: removes the "bang" at the end ──────────────────────
// - align to 2-byte samples (odd length = half sample = loud click)
// - trim a few ms of tail (some preview models emit a glitch frame)
// - fade in/out so audio never starts/ends on a non-zero sample
// - append silence so the player doesn't cut off hard
const SAMPLE_RATE = 24000;
const TRIM_TAIL_MS = 40;
const FADE_IN_MS = 5;
const FADE_OUT_MS = 30;
const PAD_END_MS = 250;

function cleanPcm(pcm) {
  let len = pcm.length - (pcm.length % 2);
  len -= Math.round((SAMPLE_RATE * TRIM_TAIL_MS) / 1000) * 2;
  if (len <= 0) return { pcm, speechSec: pcm.length / 2 / SAMPLE_RATE };

  const out = Buffer.from(pcm.subarray(0, len)); // copy, don't mutate original
  const total = len / 2;

  const fadeInN = Math.min(total, Math.round((SAMPLE_RATE * FADE_IN_MS) / 1000));
  for (let i = 0; i < fadeInN; i++) {
    out.writeInt16LE(Math.round(out.readInt16LE(i * 2) * (i / fadeInN)), i * 2);
  }

  const fadeOutN = Math.min(total, Math.round((SAMPLE_RATE * FADE_OUT_MS) / 1000));
  for (let i = 0; i < fadeOutN; i++) {
    const idx = total - fadeOutN + i;
    const gain = (fadeOutN - 1 - i) / fadeOutN;
    out.writeInt16LE(Math.round(out.readInt16LE(idx * 2) * gain), idx * 2);
  }

  const pad = Buffer.alloc(Math.round((SAMPLE_RATE * PAD_END_MS) / 1000) * 2);
  return { pcm: Buffer.concat([out, pad]), speechSec: total / SAMPLE_RATE };
}

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

// ── Estimated word timings (speech portion only, excludes padding) ──
function estimateWordTimings(fullText, durationSec) {
  const words = fullText.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const weightOf = (w) => w.length + (/[,.;:!?]$/.test(w) ? 3 : 0) + 1;
  const total = words.reduce((a, w) => a + weightOf(w), 0);
  let t = 0;
  return words.map((word) => {
    const dur = (weightOf(word) / total) * durationSec;
    const start = t;
    t += dur;
    return { word, start: +start.toFixed(3), end: +t.toFixed(3) };
  });
}

// ── Main ─────────────────────────────────────────────────────────────
export async function synthesizeModule({
  userId,
  segments,
  languageCode = "auto",
  languageLabel = "Auto",
  ttsModel = DEFAULT_TTS_MODEL,
}) {
  const tier = TTS_MODELS[ttsModel] || TTS_MODELS[DEFAULT_TTS_MODEL];
  const uid = userId || "anonymous";

  const quota = consumeTts(uid, tier.id);
  if (!quota.allowed) {
    const err = new Error(
      `Daily limit reached for ${tier.label} (${tier.dailyLimit}/day). Try another model or come back tomorrow.`
    );
    err.code = "TTS_QUOTA_EXCEEDED";
    throw err;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_FINAL_KEY });

    const { promptText, mode, speakers } = buildPrompt(
      segments,
      languageLabel,
      tier.promptStyle || "structured"
    );

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

    // TTS models occasionally return no audio part; retry once before failing.
    let part = null;
    for (let attempt = 0; attempt < 2 && !part; attempt++) {
      const response = await ai.models.generateContent({
        model: tier.model,
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        config: { responseModalities: ["AUDIO"], speechConfig },
      });
      part = response.candidates?.[0]?.content?.parts?.find((p) =>
        p.inlineData?.mimeType?.startsWith("audio/")
      );
    }
    if (!part) throw new Error("Gemini TTS returned no audio");

    const rawPcm = Buffer.from(part.inlineData.data, "base64");
    const { pcm, speechSec } = cleanPcm(rawPcm);
    const wav = pcmToWav(pcm, SAMPLE_RATE, 1, 16);
    const durationSec = pcm.length / 2 / SAMPLE_RATE;

    const fullText = (segments || []).map((s) => s.text).join(" ");
    const words = estimateWordTimings(fullText, speechSec);

    return {
      audioBase64: wav.toString("base64"),
      mimeType: "audio/wav",
      durationSec: +durationSec.toFixed(2),
      words,
      modelInfo: { tier: tier.id, label: tier.label, remaining: quota.remaining },
    };
  } catch (err) {
    refundTts(uid, tier.id); // failed generations don't cost quota
    throw err;
  }
}