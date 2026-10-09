import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import { quotaManager } from "../utils/quotaManager.js";
import { DEFAULT_TIER, QUIZ_MODEL } from "../config/geminiTiers.js";

function getGeminiStatus(error) {
  return Number(
    error?.status ??
      error?.statusCode ??
      error?.response?.status ??
      error?.error?.code ??
      error?.cause?.status ??
      0
  );
}

function getGeminiErrorText(error) {
  return String(
    error?.message ??
      error?.status ??
      error?.error?.message ??
      error?.error?.status ??
      ""
  ).toLowerCase();
}

function isGeminiBusyError(error) {
  const status = getGeminiStatus(error);
  const message = getGeminiErrorText(error);

  return (
    status === 502 ||
    status === 503 ||
    message.includes("unavailable") ||
    message.includes("service unavailable") ||
    message.includes("overloaded") ||
    message.includes("high demand")
  );
}

function isGeminiQuotaExhaustedError(error) {
  const status = getGeminiStatus(error);
  const message = getGeminiErrorText(error);

  if (message.includes("resource_exhausted")) return true;
  if (message.includes("quota exceeded")) return true;
  if (message.includes("daily quota")) return true;
  if (message.includes("daily limit")) return true;
  if (message.includes("per day")) return true;
  if (message.includes("rate limit exceeded")) return true;
  if (message.includes("quota") && status === 429) return true;

  return false;
}

function buildProviderError({ code, message, tierId, cooldownSeconds, reservationId }) {
  const error = new Error(message);
  error.code = code;
  error.tierId = tierId;
  error.cooldownSeconds = cooldownSeconds;
  error.reservationId = reservationId;
  return error;
}

async function withRetry(fn, { retries = 1, baseDelayMs = 1500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isGeminiBusyError(err) || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
}

const TONES = ["serious", "neutral", "joking", "sarcastic", "angry", "confused", "stressed"];

async function detectToneFallback({ ai, text }) {
  const prompt = `
Classify the speaker's emotional tone in this microphone transcript.
Choose exactly ONE: serious, neutral, joking, sarcastic, angry, confused, stressed.
Be decisive: use "neutral" only if there is truly no emotional signal.
Judge intent from wording and context, not the topic.
Return ONLY JSON: { "tone": "" }

TRANSCRIPT:
${text}
`;
  try {
    const res = await ai.models.generateContent({
      model: QUIZ_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "low" },
      },
    });
    const m = (res.text || "").match(/\{[\s\S]*\}/);
    const tone = m ? String(JSON.parse(m[0]).tone || "").toLowerCase().trim() : "";
    return TONES.includes(tone) ? tone : null;
  } catch (err) {
    console.error("Tone fallback failed (ignored):", err?.message);
    return null;
  }
}

export async function processWithGemini({ text, userProfile, userId, requestedTier = DEFAULT_TIER, outputLanguage = "English" }) {
  const { approvedTier, label, model, remaining, downgraded, apiKey, exhausted, reservationId } =
    quotaManager.selectModel(userId, "core", requestedTier);
  const ai = new GoogleGenAI({ apiKey });
  const { onboarding } = userProfile || {};

  const prompt = `
You are an accessibility AI for users with Auditory Processing Disorder (APD).
You receive a raw speech-to-text transcript captured from a microphone.
Your primary responsibility is to preserve meaning while improving clarity.
You MUST prioritize grammatical correctness over brevity.

────────────────────────────────
RULE 1 — OUTPUT LANGUAGE
────────────────────────────────
Generate ALL response values in: ${outputLanguage}.
JSON keys MUST stay in English; the values MUST be in ${outputLanguage}.

────────────────────────────────
RULE 2 — FIX MIC / TRANSCRIPTION ERRORS FIRST (silently)
────────────────────────────────
The transcript came from a microphone and speech recognition, so it may contain
misheard words, homophones, broken or split words, misspellings, garbled
technical terms or names.

Before doing anything else, mentally correct the transcript:
- Fix ONLY errors that are clear from the surrounding context.
  Example: "photo sent thesis" -> "photosynthesis", "pre heat the oven" -> "preheat the oven".
- If the transcript is already correct, change NOTHING.
- NEVER add new information, NEVER change the speaker's meaning, NEVER rewrite style.
- If a word is unclear and context does not make the fix obvious, keep it as is.
- Use the CORRECTED wording in every output field (simplified, keyPoints, steps,
  hardWords, speakerSegments). Never copy a misheard word into the output.
- Record each fix in "corrections" as { "heard": "", "corrected": "" }.
  If you made no fixes, "corrections" MUST be [].

────────────────────────────────
RULE 3 — ORDER OF WORK
────────────────────────────────
1. Correct the transcript (Rule 2).
2. Decide the steps (Rule 5).
3. Write the key points (Rule 4).
4. Write the simplified summary LAST (Rule 6), so it matches the rest.

────────────────────────────────
RULE 4 — KEY POINTS
────────────────────────────────
- Write 3–5 clear sentences.
- Each point must be a full sentence, never a fragment.

────────────────────────────────
RULE 5 — STEPS
────────────────────────────────
Steps are for audio where the speaker tells the listener how to DO something in
a sequence. This includes: instructions, directions, recipes, procedures,
set-up or installation guides, lab / assignment / exam instructions, how-to
explanations, and anything using ordering words such as "first", "then",
"next", "after that", "finally", "step one".

If the audio contains such a sequence you MUST fill "steps":
- 2–10 steps, in the order spoken.
- ONE action per step, written as a short complete sentence starting with a verb.
- Include the steps even if the speaker also explains why, or the tone is casual.
- If the audio is mixed, include only the actionable part as steps.

Use "steps": [] ONLY when the audio is purely:
- an explanation of how nature or a system works (photosynthesis, digestion, how engines work),
- opinions, news, stories, status updates, or casual conversation.

Examples:
Audio: "First preheat the oven to 180, then mix the flour and eggs, and bake for twenty minutes."
-> steps: ["Preheat the oven to 180°C.", "Mix the flour and the eggs.", "Bake it for twenty minutes."]
Audio: "Plants take in sunlight and turn water and air into food."
-> steps: []

When unsure whether it is a to-do sequence: if there is an ordered list of
actions the listener could perform, INCLUDE the steps.

────────────────────────────────
RULE 6 — SIMPLIFIED SUMMARY
────────────────────────────────
The "simplified" field is a single, punchy summary of the whole transcript.
- ONE or TWO complete, grammatically correct sentences.
- 12 to 30 words total.
- Clear subject and verb; keep connectors (the, is, are, to, using).
- Calm teacher tone. Preserve the real meaning.
- Tell the user the gist of what was said, so they understand in seconds.

ABSOLUTELY FORBIDDEN in "simplified":
- Keyword fragments or telegraphic speech
- Copying the transcript
- More than two sentences

BAD: "Plants water air make oxygen"
GOOD: "Plants use sunlight to turn water and air into food and oxygen."

────────────────────────────────
RULE 7 — HARD WORDS
────────────────────────────────
Detect technical or cognitively demanding words.
- Keys: lowercase, and spelled EXACTLY as the word appears in your output text
  (after correction). Single words preferred, no punctuation.
- Value: max 12 words, explain the WORD, not the sentence.
- Skip obvious words.

────────────────────────────────
RULE 8 — FLAGS
────────────────────────────────
- complex_concept → abstract or scientific
- needs_visual → a diagram would help
- multi_step → true exactly when "steps" is not empty, otherwise false

────────────────────
TONE DETECTION
────────────────────
Detect the speaker's emotional tone from wording, phrasing and context.
Allowed values: serious, neutral, joking, sarcastic, angry, confused, stressed

- ALWAYS return "overallTone": the dominant tone of the whole audio.
  Required even when there is only one speaker.
- Also return "tone" for each speaker segment.
- Be decisive. Pick the best-fitting tone when there are real signals:
  urgency or worry (stressed), frustration or hostility (angry),
  hesitation or questions (confused), humor (joking), a grave or formal
  subject (serious).
- Use "neutral" only when there is genuinely no emotional signal
  (plain factual or instructional speech).
- Judge the speaker's intent, not the topic. Sarcasm only if clearly implied.

────────────────────────────────
USER PROFILE (DO NOT IGNORE)
────────────────────────────────
Comprehension issue: ${onboarding?.comprehensionBreak || "unknown"}
Learning preference: ${onboarding?.learningPreference || "unknown"}
Listening issue: ${onboarding?.listeningThought || "unknown"}
User struggle note: "${onboarding?.struggleNote || "None"}"

────────────────────
SPEAKER & NOISE DETECTION (APD CRITICAL)
────────────────────

Analyze the transcript for speaker context.

If multiple speakers are clearly implied:
- Label speakers using roles, NOT names
- Examples: "Teacher", "Student", "Interviewer", "Speaker 1", "Speaker 2"

If and only if the conversation appears to be fictional or cinematic. For example, in movie then,
infer speaker roles consistently and label them.
If unsure, use Speaker A / Speaker B.

Rules:
- ONLY add speaker labels if context strongly suggests them
- Do NOT guess randomly
- Do NOT invent dialogue
- Do NOT split unless meaning improves clarity for APD users

If background noise, interruptions, or irrelevant chatter exists:
- Set noiseDetected = true
- Ignore noise in simplified output

Noise examples:
- Side conversations
- Laughter
- Mic disturbances
- Filler speech without meaning

────────────────────────────────
RETURN ONLY VALID JSON (keys in this order)
────────────────────────────────
{
  "corrections": [],
  "steps": [],
  "keyPoints": [],
  "simplified": "",
  "overallTone": "neutral",
  "hardWords": {},
  "speakerSegments": [
    {
      "speaker": "Narrator",
      "text": "",
      "tone": "neutral"
    }
  ],
  "noiseDetected": false,
  "flags": {
    "complex_concept": false,
    "needs_visual": false,
    "multi_step": false
  }
}

FINAL CHECK BEFORE RESPONDING:
- Did you fix clear mic errors and use the corrected words everywhere?
- If the audio has an ordered sequence of actions, are "steps" filled?
- If "simplified" sounds broken when read aloud, REWRITE it.
`;

  async function callGemini(payload) {
    try {
      const response = await withRetry(() => ai.models.generateContent(payload));
      // A successful provider response resets only the consecutive busy counter.
      quotaManager.recordSuccess(approvedTier);
      return response;
    } catch (err) {
      console.error("Gemini raw error:", getGeminiStatus(err), err?.message);
      if (isGeminiBusyError(err)) {
        const failure = quotaManager.recordFailure(
          userId,
          approvedTier,
          "core",
          reservationId,
          60
        );

        throw buildProviderError({
          code: failure.lockedToday ? "MODEL_LOCKED_TODAY" : "MODEL_BUSY",
          message: failure.lockedToday
            ? `${label} is unavailable today because it has returned repeated service-unavailable errors.`
            : `${label} is currently busy on Gemini servers. Your Cognivo token has been returned and a 60-second cooldown has been applied.`,
          tierId: approvedTier,
          cooldownSeconds: failure.lockedToday ? 0 : 60,
          reservationId,
        });
      }

      if (isGeminiQuotaExhaustedError(err)) {
        quotaManager.recordProviderQuotaExhausted(
          userId,
          approvedTier,
          "core",
          reservationId
        );

        throw buildProviderError({
          code: "PROVIDER_QUOTA_EXHAUSTED",
          message: `${label} is unavailable today because its Gemini API allowance has been exhausted.`,
          tierId: approvedTier,
          cooldownSeconds: 0,
          reservationId,
        });
      }

      throw err;
    }
  }

  const response = await callGemini({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: `${prompt}\n\nTRANSCRIPT:\n${text}` }]
      }
    ],
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" }
    }
  });
  console.log(`📡 Gemini call complete — tier=${approvedTier} model=${model} downgraded=${downgraded}`);

  const raw = response.text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("❌ Gemini raw output:", raw);
    throw new Error("Invalid Gemini response");
  }

  const result = JSON.parse(match[0]);

  const ALLOWED_TONES = [
    "serious",
    "neutral",
    "joking",
    "sarcastic",
    "angry",
    "confused",
    "stressed"
  ];

  // Overall tone is independent of speaker detection (speaker segments get
  // dropped when there's only one speaker, which used to erase the tone too).
  const segmentTones = Array.isArray(result.speakerSegments)
    ? result.speakerSegments
        .map((s) => s?.tone)
        .filter((t) => ALLOWED_TONES.includes(t) && t !== "neutral")
    : [];

  result.overallTone = ALLOWED_TONES.includes(result.overallTone)
    ? result.overallTone
    : segmentTones[0] || "neutral";

  // Second opinion: cautious models (Ultra/Pro) tend to answer "neutral".
  // A cheap model re-checks only in that case. It uses no user quota.
  if (result.overallTone === "neutral") {
    const second = await detectToneFallback({ ai, text });
    if (second) result.overallTone = second;
  }
  console.log(`🎭 [${approvedTier}] overallTone:`, result.overallTone);

  // 🧠 SPEAKER SANITY CHECK (CRITICAL)
  // 🧠 Balanced Speaker Normalization (Middle Ground)

  if (Array.isArray(result.speakerSegments)) {
    const MAX_SPEAKERS = 4;
    const MIN_CHARS = 20;

    // Remove junk
    let segments = result.speakerSegments.filter(
      s => s.text && s.text.trim().length >= MIN_CHARS
    );

    // Count speakers
    const speakerMap = {};
    segments.forEach(s => {
      speakerMap[s.speaker] = (speakerMap[s.speaker] || 0) + 1;
    });

    let speakers = Object.keys(speakerMap);

    // 🚨 If too many speakers → MERGE minor ones
    if (speakers.length > MAX_SPEAKERS) {
      const sorted = speakers.sort(
        (a, b) => speakerMap[b] - speakerMap[a]
      );

      const keep = new Set(sorted.slice(0, MAX_SPEAKERS - 1));
      const MERGED_NAME = "Team Member";

      segments = segments.map(seg => {
        if (!keep.has(seg.speaker)) {
          return {
            ...seg,
            speaker: MERGED_NAME
          };
        }
        return seg;
      });
    }

    // Recount after merge
    const finalSpeakers = new Set(
      segments.map(s => s.speaker)
    );

    // 🚫 If still meaningless → collapse
    if (finalSpeakers.size < 2) {
      result.speakerSegments = [];
    } else {
      result.speakerSegments = segments;
    }
  }

  // ─────────────────────────────
  // 🧼 STRONG POST-VALIDATION
  // ─────────────────────────────

  // Normalize arrays
  if (!Array.isArray(result.keyPoints)) result.keyPoints = [];
  if (!Array.isArray(result.steps)) result.steps = [];
  if (typeof result.hardWords !== "object" || Array.isArray(result.hardWords)) {
    result.hardWords = {};
  }

  // Normalize speakerSegments
  if (!Array.isArray(result.speakerSegments)) {
    result.speakerSegments = [];
  }

  result.speakerSegments = result.speakerSegments.filter(
    seg =>
      seg &&
      typeof seg.speaker === "string" &&
      typeof seg.text === "string" &&
      seg.text.trim().length > 0
  );

  // 🎭 Normalize tone per speaker (APD-safe)
  result.speakerSegments = result.speakerSegments.map(seg => ({
    speaker: seg.speaker || "Narrator",
    text: seg.text,
    tone: ALLOWED_TONES.includes(seg.tone) ? seg.tone : "neutral"
  }));


  // Normalize noiseDetected
  result.noiseDetected = Boolean(result.noiseDetected);

  // Steps: trust the actual steps, not the model's flag.
  // (Previously steps were wiped whenever flags.multi_step wasn't true.)
  result.steps = result.steps
    .map((s) =>
      typeof s === "string"
        ? s
        : s?.text || s?.step || s?.description || s?.action || ""
    )
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 10);

  // Corrections list (mic fixes) - sanitize
  result.corrections = Array.isArray(result.corrections)
    ? result.corrections
        .filter((c) => c && typeof c.heard === "string" && typeof c.corrected === "string")
        .filter((c) => c.heard.trim().toLowerCase() !== c.corrected.trim().toLowerCase())
        .slice(0, 10)
    : [];

  // Flags always consistent with the data
  result.flags = {
    complex_concept: Boolean(result.flags?.complex_concept),
    needs_visual: Boolean(result.flags?.needs_visual),
    multi_step: result.steps.length > 0,
  };

  // Simplified sentence validation
  if (typeof result.simplified === "string") {
    result.simplified = result.simplified
      .replace(/\bundefined\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else {
    result.simplified = "";
  }

  if (outputLanguage === "English" || outputLanguage === "en") {
    const simplifiedWords = result.simplified.split(/\s+/).filter(Boolean).length;

    // Only fall back when the summary is genuinely too short to be a sentence.
    // (The old verb whitelist rejected valid sentences like "explains"/"shows".)
    if (simplifiedWords < 6) {
      result.simplified = result.keyPoints.length > 0
        ? result.keyPoints[0]
        : "This topic explains an important idea in a simple and clear way.";
    }
  }

  console.log("✅ BACKEND OUTPUT:", {
    simplified: result.simplified,
    keyPoints: result.keyPoints.length,
    steps: result.steps.length,
    corrections: result.corrections.length,
    hardWords: Object.keys(result.hardWords).length,
    tier: approvedTier,
    downgraded
  });

  result.modelInfo = { tier: approvedTier, label, remaining, downgraded, exhausted: Boolean(exhausted) };

  return result;
}

export async function processContextQuery({
  query,
  previousResult,
  userId,
  requestedTier = DEFAULT_TIER,
  attachedFile,
  useSearch = false,
  outputLanguage = "English"
}) {
  const { approvedTier, label, model, remaining, downgraded, apiKey, exhausted, reservationId } =
    quotaManager.selectModel(userId, "core", requestedTier);
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are continuing a conversation for a user with Auditory Processing Disorder (APD).

────────────────────────────────
CRITICAL RULE — OUTPUT LANGUAGE
────────────────────────────────
You MUST translate and generate ALL your response fields in the following language: ${outputLanguage}.
The JSON structure MUST remain in English keys, but the values MUST be in ${outputLanguage}.
────────────────────────────────

The user already received this explanation:
"${previousResult.simplified}"

Key points:
${previousResult.keyPoints.join("\n")}

The user now asks:
"${query}"

Rules:
- Do NOT repeat everything
- Expand only what is asked
- Use simple, calm teacher tone
- Use examples ONLY if asked
- Keep it short and focused
${useSearch ? "- You have Google Search available; use it if the question needs current/real-world facts." : ""}

Return JSON:
{
  "simplified": "",
  "keyPoints": [],
  "steps": [],
  "hardWords": {}
}
`;

  const parts = [{ text: prompt }];
  if (attachedFile?.base64 && attachedFile?.mimeType) {
    parts.push({
      inlineData: {
        mimeType: attachedFile.mimeType,
        data: attachedFile.base64,
      },
    });
  }

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      })
    );

    quotaManager.recordSuccess(approvedTier);
    console.log(`📡 Gemini call complete (context) — tier=${approvedTier} model=${model} downgraded=${downgraded}`);

    const raw = response.text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid Gemini context response");

    const result = JSON.parse(match[0]);
    result.modelInfo = { tier: approvedTier, label, remaining, downgraded, exhausted: Boolean(exhausted) };
    return result;
  } catch (err) {
    console.error("Gemini raw error:", getGeminiStatus(err), err?.message);
    if (isGeminiBusyError(err)) {
      const failure = quotaManager.recordFailure(
        userId,
        approvedTier,
        "core",
        reservationId,
        60
      );

      throw buildProviderError({
        code: failure.lockedToday ? "MODEL_LOCKED_TODAY" : "MODEL_BUSY",
        message: failure.lockedToday
          ? `${label} is unavailable today because it has returned repeated service-unavailable errors.`
          : `${label} is currently busy on Gemini servers. Your Cognivo token has been returned and a 60-second cooldown has been applied.`,
        tierId: approvedTier,
        cooldownSeconds: failure.lockedToday ? 0 : 60,
        reservationId,
      });
    }

    if (isGeminiQuotaExhaustedError(err)) {
      quotaManager.recordProviderQuotaExhausted(
        userId,
        approvedTier,
        "core",
        reservationId
      );

      throw buildProviderError({
        code: "PROVIDER_QUOTA_EXHAUSTED",
        message: `${label} is unavailable today because its Gemini API allowance has been exhausted.`,
        tierId: approvedTier,
        cooldownSeconds: 0,
        reservationId,
      });
    }

    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// QUIZ GENERATION — used when the user presses "I Understand".
// Deliberately forced onto the "lite" tier: it's a tiny, cheap
// generation task derived from text Gemini already produced, so
// there's no reason to spend a user's scarce ultra/pro/plus quota
// on it. Kept as its own call (not folded into processWithGemini)
// so the heavily-tuned main prompt doesn't have to also juggle
// quiz-writing instructions.
// ─────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function generateQuiz({ simplified, keyPoints = [], userId, outputLanguage = "English" }) {
  // "quiz" is its own feature bucket in quotaManager — entirely separate
  // from "core", so this never decrements or shows up against the
  // ultra/pro/plus/lite quota the frontend displays for the 4 main tiers.
  // The "lite" tier id passed here just borrows that tier's dailyLimit
  // config for quiz's own counter; it has no bearing on which model runs.
  const { apiKey, approvedTier, reservationId } = quotaManager.selectModel(userId, "quiz", "lite");
  const ai = new GoogleGenAI({ apiKey });

  const sourceText = [simplified, ...(Array.isArray(keyPoints) ? keyPoints : [])]
    .filter(Boolean)
    .join("\n");

  if (!sourceText.trim()) {
    throw new Error("No content available to build a quiz from");
  }

  const prompt = `
You are writing ONE quick comprehension-check question for a user with Auditory
Processing Disorder, based ONLY on the content below. This is NOT a trick
question — it should verify they understood the gist, not test obscure detail.

────────────────────────────────
CRITICAL RULE — OUTPUT LANGUAGE
────────────────────────────────
All text values MUST be written in: ${outputLanguage}.
JSON keys stay in English.

CONTENT:
"""
${sourceText}
"""

Rules:
- Write ONE multiple-choice question directly about the content above.
- Provide exactly 3 answer options.
- Exactly ONE option must be correct and clearly supported by the content.
- The two incorrect options must be plausible-sounding but clearly wrong to
  someone who understood the content — NOT random, NOT jokes, NOT absurd.
- Do NOT reuse the same wrong-answer pattern every time (vary what makes them wrong).
- Keep the question and each option under 20 words.
- correctIndex is 0-based and refers to the "options" array as you write it.

Return ONLY this JSON, no markdown fences, no commentary:
{
  "question": "",
  "options": ["", "", ""],
  "correctIndex": 0
}
`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: QUIZ_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingLevel: "low" } },
    });
  } catch (err) {
    if (isGeminiBusyError(err)) {
      quotaManager.refund(userId, "quiz", approvedTier, reservationId);
      const quizError = new Error("The comprehension quiz is temporarily busy. Please try again shortly.");
      quizError.code = "QUIZ_BUSY";
      throw quizError;
    }

    if (isGeminiQuotaExhaustedError(err)) {
      quotaManager.refund(userId, "quiz", approvedTier, reservationId);
      const quizError = new Error("The comprehension quiz is temporarily unavailable today. Please try again tomorrow.");
      quizError.code = "QUIZ_UNAVAILABLE_TODAY";
      throw quizError;
    }

    throw err;
  }

  const raw = response.text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("❌ Gemini quiz raw output:", raw);
    throw new Error("Invalid Gemini quiz response");
  }

  const parsed = JSON.parse(match[0]);

  if (
    typeof parsed.question !== "string" ||
    !Array.isArray(parsed.options) ||
    parsed.options.length !== 3 ||
    typeof parsed.correctIndex !== "number" ||
    parsed.correctIndex < 0 ||
    parsed.correctIndex > 2
  ) {
    throw new Error("Malformed quiz payload from Gemini");
  }

  // Build {id, text} options and shuffle so the correct answer isn't
  // predictably in the same slot — then hide the answer key from the
  // response shape by only exposing correctOptionId, not an index the
  // client could infer position-independent trust from.
  const withIds = parsed.options.map((text, i) => ({
    id: `opt_${i}`,
    text,
    _correct: i === parsed.correctIndex,
  }));

  const shuffled = shuffle(withIds);
  const correctOptionId = shuffled.find((o) => o._correct)?.id;
  const options = shuffled.map(({ id, text }) => ({ id, text }));

  return {
    question: parsed.question,
    options,
    correctOptionId,
  };
}