export const TTS_MODELS = {
  "gemini-2.5-flash-tts": {
    id: "gemini-2.5-flash-tts",
    label: "Gemini 2.5 Flash TTS",
    model: "gemini-2.5-flash-preview-tts",
    dailyLimit: 3,
  },
  "gemini-3-flash-tts": {
    id: "gemini-3-flash-tts",
    label: "Gemini 3 Flash TTS",
    model: "gemini-3.1-flash-tts-preview",
    dailyLimit: 3,
  },
};

export const DEFAULT_TTS_MODEL = "gemini-3-flash-tts";

// Gemini TTS has no "emotion" field — style is steered by natural-language
// instructions in the prompt. This maps the tones your gemini.service.js
// already detects onto a delivery instruction the TTS model understands.
export const TONE_STYLE = {
  serious: "in a serious, focused tone",
  neutral: "in a calm, neutral tone",
  joking: "in a light, playful tone",
  sarcastic: "with a dry, subtly sarcastic edge",
  angry: "with firm, intense delivery, but not shouting",
  confused: "sounding uncertain, with a slightly questioning lilt",
  stressed: "with a slightly tense, urgent pace",
};

// Practical subset of Gemini TTS's supported languages (70+ on 3.1).
// Add more {code, label} pairs here any time — nothing else changes.
export const LANGUAGES = [
  { code: "auto", label: "Auto" },
  { code: "en-US", label: "English (US)" },
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "es-US", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "ar-EG", label: "Arabic" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Mandarin)" },
  { code: "bn-BD", label: "Bengali" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "mr-IN", label: "Marathi" },
  { code: "ur-PK", label: "Urdu" },
  { code: "id-ID", label: "Indonesian" },
  { code: "it-IT", label: "Italian" },
  { code: "ru-RU", label: "Russian" },
  { code: "tr-TR", label: "Turkish" },
];