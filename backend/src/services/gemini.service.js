import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import { quotaManager } from "../utils/quotaManager.js";
import { DEFAULT_TIER, QUIZ_MODEL } from "../config/geminiTiers.js";

export async function processWithGemini({ text, userProfile, userId, requestedTier = DEFAULT_TIER, outputLanguage = "English" }) {
  const { approvedTier, label, model, remaining, downgraded, apiKey, exhausted } =
    quotaManager.selectModel(userId, "core", requestedTier);
  const ai = new GoogleGenAI({ apiKey });
  const { onboarding } = userProfile || {};

  const prompt = `
You are an accessibility AI for users with Auditory Processing Disorder (APD).

────────────────────────────────
CRITICAL RULE — OUTPUT LANGUAGE
────────────────────────────────
You MUST translate and generate ALL your response fields in the following language: ${outputLanguage}.
The JSON structure MUST remain in English keys, but the values MUST be in ${outputLanguage}.
────────────────────────────────

Your primary responsibility is to preserve meaning while improving clarity.
You MUST prioritize grammatical correctness over brevity.

────────────────────────────────
CRITICAL RULE — SIMPLIFIED SENTENCE
────────────────────────────────
You MUST generate the simplified sentence AFTER you decide key points and steps.

The simplified sentence MUST:
- Be ONE complete sentence
- Contain a clear subject and verb
- Be grammatically correct spoken English
- Be at least 12 words
- Preserve scientific meaning
- Sound like a calm teacher explaining

ABSOLUTELY FORBIDDEN:
- Keyword fragments
- Telegraphic speech
- Missing verbs
- Removed connectors (the, is, are, to, using)

If unsure, REPHRASE instead of shortening.

BAD: "Plants water air make oxygen"
GOOD: "Plants use sunlight to turn water and air into food and oxygen."

────────────────────────────────
CRITICAL RULE — SIMPLIFIED SENTENCE
────────────────────────────────
The "simplified" field MUST be a single, punchy summary of the entire transcript.
- MAX 30 words.
- ONE paragraph only.
- Explain the "gist" of the conversation so a user knows exactly what happened in seconds.

ABSOLUTELY FORBIDDEN:
- Providing a full transcript in the "simplified" field.
- Going over two sentences.

────────────────────────────────
KEY POINTS
────────────────────────────────
- Write 3–5 clear sentences
- Each point must be a full sentence
- Do not oversimplify into fragments

────────────────────────────────
STEPS (VERY STRICT)
────────────────────────────────
ONLY create steps if a human must FOLLOW actions in order.

DO NOT create steps for:
- Scientific explanations
- Natural processes
- How something works

Photosynthesis, respiration, digestion = NOT steps.

If no valid steps:
- steps must be []
- flags.multi_step = false

────────────────────────────────
HARD WORD DETECTION
────────────────────────────────
Detect technical or cognitively demanding words.

Rules:
- Lowercase keys
- Max 12 words explanation
- Explain the word, not the sentence
- Skip obvious words

────────────────────────────────
FLAGS
────────────────────────────────
- complex_concept → abstract or scientific
- needs_visual → diagrams help
- multi_step → ONLY if steps exist

────────────────────
VOCAL TONE DETECTION
────────────────────
Analyze the speaker's tone based on wording and context.

Detect ONE of the following per speaker segment:
- serious
- neutral
- joking
- sarcastic
- angry
- confused
- stressed

Rules:
- Do NOT guess wildly
- If unsure, use "neutral"
- Tone must match spoken intent, not topic
- Sarcasm ONLY if clearly implied by wording

Return tone per speaker segment.

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

────────────────────
JSON ADDITION
────────────────────

Add these optional fields:

"speakerSegments": [
  { "speaker": "", "text": "" }
],
"noiseDetected": false

────────────────────────────────
RETURN ONLY VALID JSON
────────────────────────────────
{
  "simplified": "",
  "keyPoints": [],
  "steps": [],
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
If the simplified sentence sounds broken when read aloud,
REWRITE IT before returning JSON.
`;

  async function callGeminiWithRetry(payload, retries = 2) {
    try {
      return await ai.models.generateContent(payload);
    } catch (err) {
      if (retries > 0 && err?.message?.includes("503")) {
        await new Promise(r => setTimeout(r, 1200));
        return callGeminiWithRetry(payload, retries - 1);
      }
      throw err;
    }
  }

  const response = await callGeminiWithRetry({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: `${prompt}\n\nTRANSCRIPT:\n${text}` }]
      }
    ],
    config: {
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

  // Enforce steps rule
  if (!result.flags?.multi_step) {
    result.steps = [];
  }

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
    const simplifiedWords = result.simplified.split(" ").length;
    const hasVerb = /\b(is|are|was|were|use|uses|make|makes|turn|turns|take|takes|produce|produces|convert|converts)\b/i.test(result.simplified);

    if (simplifiedWords < 10 || !hasVerb) {
      result.simplified = result.keyPoints.length > 0
        ? result.keyPoints[0]
        : "This topic explains an important scientific process in a simple and clear way.";
    }
  }

  console.log("✅ BACKEND OUTPUT:", {
    simplified: result.simplified,
    keyPoints: result.keyPoints.length,
    steps: result.steps.length,
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
  const { approvedTier, label, model, remaining, downgraded, apiKey, exhausted } =
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

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    ...(useSearch ? { config: { tools: [{ googleSearch: {} }] } } : {}),
  });
  console.log(`📡 Gemini call complete (context) — tier=${approvedTier} model=${model} downgraded=${downgraded}`);

  const raw = response.text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid Gemini context response");

  const result = JSON.parse(match[0]);
  result.modelInfo = { tier: approvedTier, label, remaining, downgraded, exhausted: Boolean(exhausted) };
  return result;
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
  const { apiKey } = quotaManager.selectModel(userId, "quiz", "lite");
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

  const response = await ai.models.generateContent({
    model: QUIZ_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { thinkingConfig: { thinkingLevel: "low" } },
  });

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