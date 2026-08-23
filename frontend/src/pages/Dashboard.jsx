import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { requestAssist } from "../services/assist.api.js";
import { useTypewriter } from "../hooks/useTypewriter.js";
import MermaidDiagram from "../components/MermaidDiagram";
import TranscriptPlayer, { ModulePlayIcon } from "../components/TranscriptPlayer";

import {
  Settings,
  HelpCircle,
  User,
  Mic,
  Square,
  Sparkles,
  Check,
  ChevronDown,
  ArrowRight,
  AlertTriangle,
  Plus,
  Coins,
  BrainCircuit,
  MessageSquare,
  BookOpen,
  X,
  Edit3,
  Send,
  FileText,
  RotateCcw
} from "lucide-react";

// Updated to use soft, complementary UI tones that fit the aesthetic
const getToneColor = (tone) => {
  switch (tone) {
    case "sarcastic":
      return "bg-[#F4F0F9] text-[#7E57C2] border-[#E8DEF2]";
    case "joking":
      return "bg-[#EDF7ED] text-[#388E3C] border-[#C8E6C9]";
    case "angry":
      return "bg-[#FDEDED] text-[#D32F2F] border-[#FFCDD2]";
    case "confused":
      return "bg-[#FFF8E1] text-[#F57C00] border-[#FFECB3]";
    case "stressed":
      return "bg-[#FFF3E0] text-[#E64A19] border-[#FFE0B2]";
    case "serious":
      return "bg-[#E3F2FD] text-[#1976D2] border-[#BBDEFB]";
    default:
      return "bg-[#F5F5F5] text-[#69688D] border-[#E0E0E0]";
  }
};

// Keep this in sync with config/geminiTiers.js on the backend. Only the
// id + label are needed here — the backend is the one that knows the real
// Gemini model string, enforces the daily cap, and decides downgrades.
const MODEL_TIERS = [
  { id: "ultra", label: "Cognivo Ultra" },
  { id: "pro", label: "Cognivo Pro" },
  { id: "plus", label: "Cognivo Plus" },
  { id: "lite", label: "Cognivo Lite" },
];

const CENTER_LANGUAGES = [
  { code: "af", label: "Afrikaans" },
  { code: "sq", label: "Albanian" },
  { code: "am", label: "Amharic" },
  { code: "ar", label: "Arabic" },
  { code: "hy", label: "Armenian" },
  { code: "az", label: "Azerbaijani" },
  { code: "eu", label: "Basque" },
  { code: "be", label: "Belarusian" },
  { code: "bn", label: "Bangla" },
  { code: "bg", label: "Bulgarian" },
  { code: "my", label: "Burmese" },
  { code: "ca", label: "Catalan" },
  { code: "ceb", label: "Cebuano" },
  { code: "cmn", label: "Chinese (Mandarin)" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "en", label: "English" },
  { code: "et", label: "Estonian" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "gl", label: "Galician" },
  { code: "ka", label: "Georgian" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "gu", label: "Gujarati" },
  { code: "ht", label: "Haitian Creole" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "is", label: "Icelandic" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "jv", label: "Javanese" },
  { code: "kn", label: "Kannada" },
  { code: "ko", label: "Korean" },
  { code: "kok", label: "Konkani" },
  { code: "lo", label: "Lao" },
  { code: "la", label: "Latin" },
  { code: "lv", label: "Latvian" },
  { code: "lt", label: "Lithuanian" },
  { code: "lb", label: "Luxembourgish" },
  { code: "mk", label: "Macedonian" },
  { code: "mai", label: "Maithili" },
  { code: "mg", label: "Malagasy" },
  { code: "ms", label: "Malay" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "mn", label: "Mongolian" },
  { code: "ne", label: "Nepali" },
  { code: "nb", label: "Norwegian (Bokmål)" },
  { code: "nn", label: "Norwegian (Nynorsk)" },
  { code: "or", label: "Odia" },
  { code: "ps", label: "Pashto" },
  { code: "fa", label: "Persian" },
  { code: "fil", label: "Filipino" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pa", label: "Punjabi" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sr", label: "Serbian" },
  { code: "si", label: "Sinhala" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "es", label: "Spanish" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "vi", label: "Vietnamese" },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DEFAULT_API_BASE_URL = "http://localhost:3000/api";

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
    .replace(/\/+$/, "");
}

function buildApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${cleanPath}`;
}

function normalizeMermaidDiagram(rawDiagram) {
  if (!rawDiagram || typeof rawDiagram !== "string") return null;

  const withoutFences = rawDiagram
    .replace(/```mermaid/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!withoutFences || /^none$/i.test(withoutFences)) {
    return null;
  }

  const lines = withoutFences
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const diagramStart = lines.findIndex((line) =>
    /^(flowchart|graph)\b/i.test(line)
  );

  if (diagramStart === -1) {
    return null;
  }

  const normalized = lines.slice(diagramStart).join("\n");
  return normalized || null;
}

function isDiagramDense(diagram) {
  if (!diagram) return true;
  if (diagram.length > 2200) return true;

  const quotedLabels = [...diagram.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  return quotedLabels.some((label) => label.length > 90);
}

function buildFallbackDiagram({ simplified, keyPoints }) {
  const sourceText = simplified || (Array.isArray(keyPoints) ? keyPoints.join(" ") : "");
  if (!sourceText) return null;

  const words = sourceText.replace(/\s+/g, " ").trim().split(" ");
  const chunks = [];
  const maxWordsPerNode = 6;
  const maxNodes = 6; 

  for (let i = 0; i < words.length && chunks.length < maxNodes; i += maxWordsPerNode) {
    let chunk = words.slice(i, i + maxWordsPerNode).join(" ").replace(/"/g, "'");
    if (chunk) chunks.push(chunk);
  }

  if (chunks.length === 0) return null;

  const lines = ["flowchart TD"];
  chunks.forEach((label, index) => {
    lines.push(`N${index}["\`${label}\`"]`);
  });

  for (let i = 1; i < chunks.length; i += 1) {
    lines.push(`N${i - 1} --> N${i}`);
  }

  return lines.join("\n");
}

const PremiumLoader = ({ text }) => (
  <div className="flex flex-col items-center justify-center">
    <div className="relative flex items-center justify-center w-[88px] h-[88px] mb-6 drop-shadow-xl">
      <div className="absolute inset-0 rounded-full border-[3px] border-[#1D2633]/5"></div>
      <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#568FBD] border-r-[#76A7C9] animate-[spin_1.5s_cubic-bezier(0.68,-0.55,0.26,1.55)_infinite]"></div>
      <div className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-[#1D2633] border-l-[#1D2633]/40 animate-[spin_2s_linear_infinite_reverse]"></div>
      <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#1D2633]/5 to-transparent flex items-center justify-center backdrop-blur-sm">
        <Sparkles size={24} className="text-[#1D2633] animate-pulse" strokeWidth={1.5} />
      </div>
    </div>
    <h2 className="text-[22px] sm:text-[24px] font-bold text-[#1D2633] font-[Space_Grotesk,sans-serif] mb-2 tracking-tight">
      {text || "Processing"}
    </h2>
  </div>
);

const Dashboard = () => {
  const [profileId, setProfileId] = useState(null);
  const [selectedModel, setSelectedModel] = useState("pro");
  const [quotaStats, setQuotaStats] = useState(null);
  const [lastModelInfo, setLastModelInfo] = useState(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);

  const [contextQuery, setContextQuery] = useState("");
  const [loadingContextQuery, setLoadingContextQuery] = useState(false);

  // Requirement 4: Support maximum of 2 files attached
  const [attachedFiles, setAttachedFiles] = useState([]);

  const [mermaidDiagram, setMermaidDiagram] = useState(null);
  const [loadingMermaid, setLoadingMermaid] = useState(false);

  const [assistResult, setAssistResult] = useState(null);
  const [loadingAssist, setLoadingAssist] = useState(false);

  const [recording, setRecording] = useState(false);

  // Requirement 9: Visual Aids off by default
  const [allowVisuals, setAllowVisuals] = useState(false);

  // Requirement 2: Chat Mode
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const chatEndRef = useRef(null);

  // Requirement 7 & 8: Chrome-style tabs for center panel content
  const [activeTab, setActiveTab] = useState("simplified");

  const [showNoiseNotice, setShowNoiseNotice] = useState(false);

  // Requirement 1 & 14: Onboarding editing state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingAnswers, setOnboardingAnswers] = useState({
    comprehensionBreak: "miss_key_terms",
    learningPreference: "simple_words",
    listeningThought: "missed_what_was_said",
    struggleNote: "",
    uiPreferences: { font: "Atkinson Hyperlegible", fontSize: "medium", colorMode: "light" },
  });
  const [tempOnboarding, setTempOnboarding] = useState({ ...onboardingAnswers });

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [quizState, setQuizState] = useState({ isOpen: false, status: 'idle' });
  const [quizData, setQuizData] = useState(null); // { question, options: [{id,text}], correctOptionId }
  const [downgradeNotice, setDowngradeNotice] = useState(null);

  const mediaStreamRef = useRef(null);
  const monitorContextRef = useRef(null);
  const monitorSourceRef = useRef(null);
  const wsRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const usedHardWordsRef = useRef(new Set());

  const navigate = useNavigate();
  const animationDelay = 110;

  const hasSpeakers =
    Array.isArray(assistResult?.speakerSegments) &&
    assistResult.speakerSegments.length >= 2;

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Tone-tagged segments only apply if assistResult was generated FROM this
  // exact session — otherwise fall back to the session's plain transcript.
  const activeSpeakerSegments =
    selectedSessionId &&
    assistResult?.sourceSessionId === selectedSessionId &&
    Array.isArray(assistResult?.speakerSegments) &&
    assistResult.speakerSegments.length > 0
      ? assistResult.speakerSegments
      : null;

  const hasSteps = assistResult?.flags?.multi_step && assistResult?.steps?.length > 0;
  const hasVisuals = Boolean(mermaidDiagram);

  const {
    text: animatedSimplified,
    done: simplifiedDone
  } = useTypewriter(
    assistResult?._rawSimplified || "",
    animationDelay,
    false
  );

  // TTS Sync State
  const [ttsWords, setTtsWords] = useState([]);
  const [ttsActiveIdx, setTtsActiveIdx] = useState(-1);
  const [ttsLoading, setTtsLoading] = useState(false);
  const previousTtsLoadingRef = useRef(false);

  const [openHardWord, setOpenHardWord] = useState(null);

  // Center Panel Language State
  const [centerLanguage, setCenterLanguage] = useState("English");
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const languageDropdownRef = useRef(null);

  // Mobile-only section switcher. Desktop (lg+) always shows all three
  // columns exactly as before — this state is ignored above the lg breakpoint.
  const [mobileView, setMobileView] = useState("assistant"); // 'transcript' | 'assistant' | 'controls'

  // 2. FETCH PROFILE ON LOAD
  useEffect(() => {
    if (!profileId) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(buildApiUrl(`/onboarding/${profileId}`));
        const data = await res.json();
        if (data.success && data.profile) {
          setOnboardingAnswers({
            ...data.profile.onboarding,
            uiPreferences: data.profile.uiPreferences || { font: "Atkinson Hyperlegible" },
          });
        }
      } catch (err) {
        console.error("Failed to fetch onboarding profile:", err);
      }
    };
    fetchProfile();
  }, [profileId]);

  // Scroll to bottom of chat automatically in Chat Mode
  useEffect(() => {
    if (chatMode) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatMode]);

  // Adjust active tab if a tab becomes unavailable
  useEffect(() => {
    if (activeTab === "steps" && !hasSteps) setActiveTab("simplified");
    if (activeTab === "visuals" && !hasVisuals) setActiveTab("simplified");
  }, [hasSteps, hasVisuals, activeTab]);

  useEffect(() => {
    if (!assistResult?.noiseDetected || chatMode) return;

    setShowNoiseNotice(true);

    const timer = setTimeout(() => {
      setShowNoiseNotice(false);
    }, 4500);

    return () => clearTimeout(timer);
  }, [assistResult?.noiseDetected, chatMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target)
      ) {
        setIsModelDropdownOpen(false);
      }
    };

    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  useEffect(() => {
  const handleClickOutside = (event) => {
    if (
      languageDropdownRef.current &&
      !languageDropdownRef.current.contains(event.target)
    ) {
      setIsLanguageDropdownOpen(false);
    }
  };

  if (isLanguageDropdownOpen) {
    document.addEventListener("mousedown", handleClickOutside);
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [isLanguageDropdownOpen]);

  // Session management effect (1-minute intervals)
  useEffect(() => { 
    let interval; 
    if (recording && !chatMode) { 
      interval = setInterval(() => { 
        const newSessionId = Date.now();

        setSessions(prev => { 
          let updated = prev.map(s =>  
            s.isActive ? { ...s, isActive: false } : s 
          ); 
          
          if (updated.length >= 5) { 
            updated = updated.slice(1); 
          } 
          
          return [...updated, {  
            id: newSessionId,  
            text: "",  
            isActive: true,  
            isCompleted: false,  
            startTime: Date.now()  
          }]; 
        }); 

        setSelectedSessionId(newSessionId);
      }, 60000); 
    } 

    return () => clearInterval(interval); 
  }, [recording, chatMode]);

  useEffect(() => {
    const wasLoading = previousTtsLoadingRef.current;

    // TTS went from "preparing" -> "ready"
    if (wasLoading && !ttsLoading) {
      setMobileView("transcript");
    }

    previousTtsLoadingRef.current = ttsLoading;
  }, [ttsLoading]);

  

  const renderTextWithHighlights = (text, allowHighlighting = true) => {
    if (!text || !assistResult?.hardWords) return text;

    const hardWordsMap = assistResult.hardWords;
    const wordsToMatch = Object.keys(hardWordsMap);

    if (wordsToMatch.length === 0) return text;

    const sortedWords = [...wordsToMatch].sort((a, b) => b.length - a.length);
    const escapedWords = sortedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(\\b${escapedWords.join("\\b|\\b")}\\b)`, "gi");

    const parts = text.split(regex);

    return parts.map((part, i) => {
      const lowerPart = part.toLowerCase();
      const originalKey = wordsToMatch.find(w => w.toLowerCase() === lowerPart);

      if (
        allowHighlighting &&
        originalKey &&
        !usedHardWordsRef.current.has(lowerPart)
      ) {
        const wordId = `${originalKey}-${i}`;
        const isOpen = openHardWord === wordId;

        return (
          <span
            key={i}
            onClick={() => setOpenHardWord(isOpen ? null : wordId)}
            className="relative z-[9998] group text-[#568FBD] font-semibold underline decoration-dotted decoration-[#568FBD]/50 cursor-help touch-manipulation transition-colors hover:text-[#76A7C9]"
          >
            {part}

            <span
              className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1D2633] text-white text-[12.5px] px-3.5 py-2.5 rounded-xl shadow-[0_12px_24px_-8px_rgba(29,38,51,0.3)] z-[99999] w-max max-w-[220px] text-center leading-snug normal-case font-normal animate-slide-up font-[Atkinson_Hyperlegible,sans-serif] pointer-events-none ${
                isOpen ? "block" : "hidden group-hover:block"
              }`}
            >
              {hardWordsMap[originalKey]}

              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1D2633]" />
            </span>
          </span>
        );
      }
      return part;
    });
  };

  const refreshQuota = async () => {
    if (!profileId) return;
    try {
      const res = await fetch(buildApiUrl(`/quota/${profileId}`));
      if (!res.ok) return;
      const data = await res.json();
      setQuotaStats(data.tiers || null);
    } catch (err) {
      console.error("Quota fetch failed:", err);
    }
  };

  useEffect(() => {
    refreshQuota();
  }, [profileId]);

  // Requirement 4: File Selection Handler (Max 2 files)
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setAttachedFiles((prev) => {
      const combined = [...prev, ...files];
      if (combined.length > 2) {
        alert("You can attach a maximum of 2 files at a time.");
        return combined.slice(0, 2);
      }
      return combined;
    });
    e.target.value = "";
  };

  const removeAttachedFile = (indexToRemove) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleContextQuery = async () => {
    if ((!contextQuery.trim() && attachedFiles.length === 0) || !profileId) return;
    if (!chatMode && !assistResult) return;

    const userQueryText = contextQuery.trim();
    const currentFiles = [...attachedFiles];

    setContextQuery("");
    setAttachedFiles([]);

    if (chatMode) {
      const userMsg = {
        id: Date.now(),
        sender: "user",
        text: userQueryText || "Attached files for context",
        files: currentFiles.map((f) => f.name),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, userMsg]);
    }

    try {
      setLoadingContextQuery(true);

      // Structure frontend for max 2 files while preserving backward-compatible single payload for current backend
      let fileData = undefined;
      if (currentFiles.length > 0) {
        fileData = {
          mimeType: currentFiles[0].type,
          base64: await fileToBase64(currentFiles[0]),
        };
      }

      const res = await fetch(buildApiUrl("/assist/context"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          userId: profileId,
          query: userQueryText || "Analyze the provided attachment and context.",
          previousResult: chatMode
          ? { simplified: "Conversational Context", keyPoints: [] }
          : (assistResult || { simplified: "Conversational Context", keyPoints: [] }),
          requestedTier: selectedModel,
          attachedFile: fileData,
          outputLanguage: centerLanguage
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();

      if (chatMode) {

        const aiMsg = {
          id: Date.now() + 1,
          sender: "ai",
          text: data.simplified || "Here is what I found based on your prompt.",
          keyPoints: data.keyPoints,
          steps: data.steps,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        setChatMessages((prev) => [...prev, aiMsg]);
      } else {

        setAssistResult({
          ...data,
          _rawSimplified: data.simplified,
          sourceSessionId: selectedSessionId,
        });

        if (data.modelInfo) {
          setLastModelInfo(data.modelInfo);
        }
      }

      usedHardWordsRef.current.clear();
      refreshQuota();
    } catch (err) {
      console.error("Context query failed:", err);
      alert("AI could not process the request");
    } finally {
      setLoadingContextQuery(false);
    }
  };

  const handleIDontUnderstand = async () => {
    if (!selectedSessionId) return;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return;

    setLoadingAssist(true);
    try {
      const res = await fetch(buildApiUrl("/assist"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          userId: profileId,
          text: session.text || "I am currently transcribing audio, please analyze the context gathered so far.",
          requestedTier: selectedModel,
          outputLanguage: centerLanguage
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      setAssistResult({
        ...data,
        _rawSimplified: data.simplified,
        sourceSessionId: selectedSessionId,
      });

      if (data.modelInfo) {
        setLastModelInfo(data.modelInfo);

        if (data.modelInfo.downgraded && data.modelInfo.tier) {
          const requestedTierLabel =
            MODEL_TIERS.find((t) => t.id === selectedModel)?.label || "Requested Tier";

          setSelectedModel(data.modelInfo.tier);

          setDowngradeNotice({
            fromLabel: requestedTierLabel,
            toLabel: data.modelInfo.label,
          });
        }
      }

      usedHardWordsRef.current.clear();
      refreshQuota();
    } catch (err) {
      console.error(err);
      alert("Failed to process session.");
    } finally {
      setLoadingAssist(false);
    }
  };

  const handleQuizSuccess = () => {
    setSessions(prev => prev.map(s => 
      s.id === selectedSessionId ? { ...s, isCompleted: true } : s
    ));
    setAssistResult(null); 
    setQuizState({ isOpen: false, status: 'idle' });
    setQuizData(null);
  };

  // Fetches a real, content-specific MCQ from the backend (cheap "lite"
  // tier call) instead of showing the old static/always-B question.
  const openQuiz = async () => {
    if (!assistResult?._rawSimplified || !profileId) return;

    setQuizState({ isOpen: true, status: 'loading' });

    try {
      const res = await fetch(buildApiUrl("/assist/quiz"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          userId: profileId,
          simplified: assistResult._rawSimplified,
          keyPoints: assistResult.keyPoints || [],
          outputLanguage: centerLanguage,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setQuizData(data);
      setQuizState({ isOpen: true, status: 'idle' });
    } catch (err) {
      console.error("Quiz generation failed:", err);
      setQuizState({ isOpen: true, status: 'error' });
    }
  };

  const handleQuizAnswer = (optionId) => {
    if (!quizData) return;
    if (optionId === quizData.correctOptionId) {
      handleQuizSuccess();
    } else {
      setQuizState({ isOpen: true, status: 'wrong' });
    }
  };

  // Wrong answer -> send them back to re-read the simplified explanation
  // instead of just letting them retry blind.
  const handleReviewAgain = () => {
    setQuizState({ isOpen: false, status: 'idle' });
    setQuizData(null);
    setActiveTab('simplified');
  };

  useEffect(() => {
    const id = localStorage.getItem("aurasync_profile_id");
    setProfileId(id);
  }, []);

  useEffect(() => {
    if (assistResult) {
      usedHardWordsRef.current.clear();
    }
  }, [assistResult]);

  useEffect(() => {
    if (!assistResult?.simplified || !allowVisuals) {
      setLoadingMermaid(false);
      setMermaidDiagram(null);
      return;
    }

    let cancelled = false;
    const fallbackDiagram = buildFallbackDiagram({
      simplified: assistResult.simplified,
      keyPoints: assistResult.keyPoints || [],
    });

    (async () => {
      try {
        setLoadingMermaid(true);
        setMermaidDiagram(null);

        const res = await fetch(buildApiUrl("/mermaid"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simplified: assistResult.simplified,
            keyPoints: assistResult.keyPoints || [],
            userPreferences: { allowVisuals },
            userId: profileId,
          }),
        });

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        const normalizedRemote = normalizeMermaidDiagram(data?.diagram);
        const finalDiagram = normalizedRemote && !isDiagramDense(normalizedRemote)
            ? normalizedRemote
            : fallbackDiagram;

        if (!cancelled) setMermaidDiagram(finalDiagram || null);
      } catch (err) {
        if (!cancelled) setMermaidDiagram(fallbackDiagram || null);
      } finally {
        if (!cancelled) setLoadingMermaid(false);
      }
    })();

    return () => { cancelled = true; };
  }, [assistResult, allowVisuals]);

  const isExtensionContext = () => typeof chrome !== "undefined" && Boolean(chrome?.runtime?.id);

  const cleanupCapturedAudio = async () => {
    try {
      if (monitorSourceRef.current) monitorSourceRef.current.disconnect();
    } catch (err) {} finally { monitorSourceRef.current = null; }

    try {
      if (monitorContextRef.current) await monitorContextRef.current.close();
    } catch (err) {} finally { monitorContextRef.current = null; }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const attachTabAudioMonitor = async (stream) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    try {
      const context = new AudioContextCtor();
      const source = context.createMediaStreamSource(stream);
      source.connect(context.destination);
      if (context.state === "suspended") await context.resume();
      monitorContextRef.current = context;
      monitorSourceRef.current = source;
    } catch (err) { console.warn(err); }
  };

  const captureTabAudioStream = async () => {
    return new Promise((resolve, reject) => {
      if (!chrome?.tabCapture?.capture) return reject(new Error("API unavailable"));
      chrome.tabCapture.capture({ audio: true, video: false }, async (stream) => {
        if (chrome.runtime?.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!stream) return reject(new Error("Failed capture"));
        await attachTabAudioMonitor(stream);
        resolve(stream);
      });
    });
  };

  const getRecordingStream = async () => {
    if (isExtensionContext() && chrome?.tabCapture?.capture) return captureTabAudioStream();
    return navigator.mediaDevices.getUserMedia({ audio: true });
  };

  // Requirement 5: Start Listening creates a completely fresh session
// 1. Updated handleStartListening in Dashboard.js
const handleStartListening = async () => {
  try {
    setSessions([]);
    setSelectedSessionId(null);
    setAssistResult(null);
    setMermaidDiagram(null);
    setChatMessages([]);
    setAttachedFiles([]);
    setDowngradeNotice(null);
    setQuizState({ isOpen: false, status: 'idle' });
    setQuizData(null);

    const newSessionId = Date.now();
    setSessions([{  
      id: newSessionId,  
      text: "",  
      isActive: true,  
      isCompleted: false,  
      startTime: Date.now()  
    }]); 

    setSelectedSessionId(newSessionId);
    
    const stream = await getRecordingStream();
    mediaStreamRef.current = stream;

    const wsUrl = buildApiUrl("/ws/live-audio").replace(/^http/, "ws");
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer"; // Ensure binary buffer delivery
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "transcript" && data.text?.trim()) {
        setSessions(prev => {
          const activeIndex = prev.findIndex(s => s.isActive);
          if (activeIndex === -1) return prev;

          const newText = data.text.trim();
          const newSessions = [...prev];
          const currentText = newSessions[activeIndex].text.trim();

          if (currentText === newText || currentText.endsWith(newText)) {
            return prev;
          }

          newSessions[activeIndex] = {
            ...newSessions[activeIndex],
            text: currentText ? `${currentText} ${newText}` : newText
          };

          return newSessions;
        });
      }
    };

    ws.onopen = async () => {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextCtor({ sampleRate: 16000 });
      
      // Explicitly resume audio context inside async socket opener
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      monitorContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      monitorSourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32Array = e.inputBuffer.getChannelData(0);
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768));
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(int16Array.buffer); 
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    };

    setRecording(true);
  } catch (err) {
    console.error(err);
    alert("Unable to start microphone recording.");
  }
};

// 2. Fix line ~295 inside handleContextQuery:
// Change: sourceSessionId: session.id
// To:     sourceSessionId: selectedSessionId

  const stopRecording = async () => {
    setRecording(false);
    setSessions(prev => prev.map(s => s.isActive ? { ...s, isActive: false } : s));

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }

    await cleanupCapturedAudio();
  };

  useEffect(() => {
    return () => {
      cleanupCapturedAudio().catch(() => {});
    };
  }, []);

  // 3. API CALL TO SAVE EDITS
  const saveOnboardingProfile = async () => {
    try {
      const { uiPreferences, ...restOnboarding } = tempOnboarding;
      const res = await fetch(buildApiUrl(`/onboarding/${profileId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding: restOnboarding, uiPreferences })
      });
      if (!res.ok) throw new Error("Failed to update");

      setOnboardingAnswers({ ...tempOnboarding });
      if (uiPreferences?.font) {
        document.body.style.fontFamily = `"${uiPreferences.font}", sans-serif`;
        localStorage.setItem("user_font", uiPreferences.font); // keeps App.jsx's on-load effect in sync
      }
      setIsOnboardingOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile updates.");
    }
  };

  const isCenterLoading = loadingAssist || (loadingContextQuery && !chatMode);
  const selectedTierStats = quotaStats?.find((t) => t.id === selectedModel) || null;

  {/* const triggerNoiseNotice = () => {
    setShowNoiseNotice(true);

    window.setTimeout(() => {
      setShowNoiseNotice(false);
    }, 4500);
  }; */}

  const resetToHome = async () => {
    try {
      setRecording(false);

      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "stop" }));
          }
          wsRef.current.close();
        } catch (err) {
          console.warn("Failed to close websocket:", err);
        }

        wsRef.current = null;
      }

      if (audioProcessorRef.current) {
        try {
          audioProcessorRef.current.disconnect();
        } catch (err) {}

        audioProcessorRef.current = null;
      }

      await cleanupCapturedAudio();

      localStorage.removeItem("aurasync_profile_id");

      setSessions([]);
      setSelectedSessionId(null);
      setAssistResult(null);
      setMermaidDiagram(null);
      setChatMessages([]);
      setAttachedFiles([]);
      setContextQuery("");
      setDowngradeNotice(null);
      setShowNoiseNotice(false);
      setQuizState({ isOpen: false, status: "idle" });
      setQuizData(null);

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Reset failed:", err);

      localStorage.removeItem("aurasync_profile_id");
      navigate("/", { replace: true });
    }
  };

  {/*const triggerDowngradeTest = () => {
    const requestedTierLabel =
      MODEL_TIERS.find((t) => t.id === selectedModel)?.label || "Cognivo Ultra";

    // Pick a different tier for testing
    const fallbackTier =
      MODEL_TIERS.find((t) => t.id !== selectedModel) || MODEL_TIERS[1];

    setSelectedModel(fallbackTier.id);

    setDowngradeNotice({
      fromLabel: requestedTierLabel,
      toLabel: fallbackTier.label,
    });
  };*/}

  return (
    <div
      className="h-screen h-[100dvh] overflow-hidden bg-[#E3E2D9] md:p-4 lg:p-6 flex flex-col text-[#1D2633] antialiased"
      style={{ fontFamily: `"${onboardingAnswers.uiPreferences?.font || "Atkinson Hyperlegible"}", sans-serif` }}
    >
      
      {/* Outer App Container */}
      <div className="flex-1 min-h-0 w-full max-w-[1500px] mx-auto bg-white flex flex-col relative md:rounded-[2rem] md:shadow-[0_24px_48px_-16px_rgba(29,38,51,0.14)] md:border border-[#1D2633]/10 overflow-hidden transition-all">
        
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 sm:px-7 sm:py-5 border-b border-[#1D2633]/5 bg-white relative z-[60] lg:z-20 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <img
              src="/logo.png"
              alt="Cognivo"
              className="h-8 w-8 sm:h-12 sm:w-12 rounded-full object-contain shrink-0"
            />

            <h1 className="text-[14px] sm:text-[20px] font-extrabold tracking-[0.10em] sm:tracking-[0.16em] text-[#1D2633] uppercase font-[Space_Grotesk,sans-serif] truncate">
              Cognivo
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">

            {/*
            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={triggerNoiseNotice}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#E64A19] bg-[#FFF8E1] border border-[#FFECB3] hover:bg-[#FFF3CD] transition-all active:scale-95"
                title="Test background noise notification"
              >
                <AlertTriangle size={13} />
                Noise
              </button>

              <button
                type="button"
                onClick={triggerDowngradeTest}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#D97706] bg-[#FFF8E1] border border-[#FFECB3] hover:bg-[#FFF3CD] transition-all active:scale-95"
                title="Test model downgrade notification"
              >
                <AlertTriangle size={13} />
                Downgrade
              </button>

              <button
                type="button"
                onClick={resetToHome}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#69688D] bg-[#F5F6F4] border border-[#1D2633]/10 hover:bg-[#EEF1F0] transition-all active:scale-95"
                title="Reset dashboard and return home"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            </div> */}
            
            {/* Requirement 6: Custom Premium Model Selector Popover */}
            <div ref={modelDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1 sm:gap-2 bg-white border border-[#1D2633]/10 rounded-xl px-2 sm:px-3 py-1.5 shadow-xs hover:border-[#76A7C9]/60 transition-all text-left max-w-[167px] sm:max-w-none shrink-0"
              >
                <span className="text-[10px] sm:text-[13.5px] font-bold text-[#1D2633]">
                  {MODEL_TIERS.find((t) => t.id === selectedModel)?.label || "Cognivo Model"}
                </span>
                <div className="w-px h-4 bg-[#1D2633]/10 mx-0.5"></div>
                <div className="flex items-center gap-1 px-1 sm:px-1.5 py-0.5 bg-[#FAFAFA] rounded-md text-[9.5px] sm:text-[11.5px] font-bold text-[#69688D] shrink-0">
                  <Coins size={11} className="text-[#568FBD] sm:w-[13px] sm:h-[13px]" />
                  <span>
                    {selectedTierStats
                      ? `${selectedTierStats.remaining}/${selectedTierStats.limit}`
                      : "—"}
                  </span>
                </div>
                <ChevronDown
                  size={12}
                  className={`sm:w-[14px] sm:h-[14px] text-[#69688D] transition-transform duration-200 ${
                    isModelDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-full lg:w-64 bg-white border border-[#1D2633]/10 rounded-2xl shadow-xl z-[100] p-2 space-y-1 animate-slide-up">
                  {MODEL_TIERS.map((tier) => {
                    const stat = quotaStats?.find((s) => s.id === tier.id);
                    const isExhausted = stat && stat.remaining === 0;
                    const isSelected = selectedModel === tier.id;

                    return (
                      <button
                        key={tier.id}
                        disabled={isExhausted}
                        onClick={() => {
                          setSelectedModel(tier.id);
                          setDowngradeNotice(null);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                          isSelected
                            ? "bg-[#1D2633] text-white"
                            : isExhausted
                            ? "opacity-40 bg-gray-50 cursor-not-allowed text-[#69688D]"
                            : "hover:bg-[#FAFAFA] text-[#1D2633]"
                        }`}
                      >
                        <div>
                          <div className="text-[13px] font-bold">{tier.label}</div>
                          <div className={`text-[11px] ${isSelected ? "text-white/70" : "text-[#69688D]"}`}>
                            
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-white" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-[#1D2633]/10 hidden sm:block"></div>

            {/* Requirement 1 & 14: Edit Profile Button replaces "New Session" */}
            <button
              onClick={() => {
                setTempOnboarding({ ...onboardingAnswers });
                setIsOnboardingOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[12px] sm:text-[13.5px] font-bold text-[#1D2633] bg-[#F5F6F4] border border-[#1D2633]/10 shadow-xs hover:bg-[#EEF1F0] hover:border-[#1D2633]/20 hover:shadow-md active:scale-95 transition-all whitespace-nowrap"
            >
              <Edit3 size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
          </div>
        </header>

        {/* Mobile Section Switcher — lets phones/extensions view one column at a
            time (full height each) instead of squeezing all three together.
            Desktop (lg+) ignores this entirely and shows all three as before. */}
        <div className="lg:hidden flex items-center gap-1 px-3 py-2 bg-[#FAFAFA] border-b border-[#1D2633]/5 shrink-0 z-20">
          <button
            type="button"
            onClick={() => setMobileView("transcript")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold transition-all ${
              mobileView === "transcript"
                ? "bg-white text-[#1D2633] shadow-xs border border-[#1D2633]/10"
                : "text-[#69688D] border border-transparent"
            }`}
          >
            <BookOpen size={14} />
            <span>Transcript</span>
            {recording && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileView("assistant")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold transition-all ${
              mobileView === "assistant"
                ? "bg-white text-[#1D2633] shadow-xs border border-[#1D2633]/10"
                : "text-[#69688D] border border-transparent"
            }`}
          >
            {chatMode ? <MessageSquare size={14} /> : <Sparkles size={14} />}
            <span>{chatMode ? "Chat" : "Assistant"}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileView("controls")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold transition-all ${
              mobileView === "controls"
                ? "bg-white text-[#1D2633] shadow-xs border border-[#1D2633]/10"
                : "text-[#69688D] border border-transparent"
            }`}
          >
            <Settings size={14} />
            <span>Controls</span>
          </button>
        </div>

        {showNoiseNotice && !chatMode && (
          <div className="absolute top-6 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-[550px] pointer-events-none animate-noise-toast">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FFF8E1] border border-[#FFECB3] shadow-[0_10px_30px_-12px_rgba(29,38,51,0.25)]">
              <div className="w-8 h-8 rounded-lg bg-[#FFE0B2] flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-[#E64A19]" />
              </div>
              <span className="text-[13px] sm:text-[13.5px] font-semibold text-[#1D2633] leading-snug text-center">
                Background noise detected. Non-essential audio was filtered for clarity.
              </span>
            </div>
          </div>
        )}

        {/* 3-Column Interface Layout */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Column: Live Transcription Panel */}
          <aside
            className={`${
              mobileView === "transcript"
                ? "flex flex-1 min-h-0"
                : "hidden"
            } lg:flex w-full lg:flex-[0_0_280px] xl:flex-[0_0_300px] lg:max-w-[280px] xl:max-w-[320px] lg:min-w-0 lg:max-h-none overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#FAFAFA] border-b lg:border-b-0 lg:border-r border-[#1D2633]/5 flex-col`}
          >
            <div className="pt-3 px-5 pb-5 sm:pt-4 sm:px-7 sm:pb-7 flex flex-col h-full">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-[#69688D] flex items-center gap-2 mb-5">
                <BookOpen size={16} /> Live Transcription
              </h3>
              
              <div className="space-y-3 flex-1">
                {sessions.length === 0 ? (
                  <div className="text-[13px] text-[#69688D]/70 italic flex flex-col items-center justify-center h-full text-center p-4 border-2 border-dashed border-[#1D2633]/10 rounded-2xl">
                    <MessageSquare size={24} className="mb-2 opacity-50" />
                    Start listening to capture 1-minute transcription sessions.
                  </div>
                ) : (
                  sessions.map((session, i) => (
                    <div 
                      key={session.id} 
                      className={`border-2 rounded-xl overflow-hidden transition-all duration-300 ${
                        session.isCompleted 
                          ? 'border-[#388E3C]/50 bg-[#EDF7ED]/30' 
                          : selectedSessionId === session.id 
                            ? 'border-[#568FBD] bg-white shadow-xs' 
                            : 'border-[#1D2633]/10 bg-white hover:border-[#1D2633]/20 cursor-pointer'
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedSessionId(session.id)}
                        className="w-full p-3.5 flex justify-between items-center bg-transparent cursor-pointer"
                      >
                        <span className="font-bold text-[13.5px] text-[#1D2633]">Minute {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <ModulePlayIcon disabled={!session.text} onClick={() => setSelectedSessionId(session.id)} />
                          {session.isCompleted && <Check size={16} strokeWidth={3} className="text-[#388E3C]" />}
                          {session.isActive && !session.isCompleted && (
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                          )}
                        </div>
                      </div>
                      
                      {/* Left Column Transcript Details */}
                      {selectedSessionId === session.id && (
                        <div className="p-3.5 pt-1 border-t border-[#1D2633]/5 text-[13.5px] text-[#69688D] bg-transparent leading-relaxed animate-slide-up">
                          {session.text ? (
                            ttsWords.length > 0 ? (
                              <p className="break-words min-w-0">
                                {ttsWords.map((w, i) => (
                                  <span key={i} className={i === ttsActiveIdx ? "bg-[#FDE68A] text-[#1D2633] rounded px-0.5" : ""}>{w.word} </span>
                                ))}
                              </p>
                            ) : (
                              <span>{session.text}</span>
                            )
                          ) : session.isActive ? (
                            <span className="flex items-center gap-2 italic">
                              Transcribing live stream<span className="loading-dots"></span>
                            </span>
                          ) : (
                            <span className="italic opacity-60">No speech detected in this interval.</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* Center Column: Main Content / Chat Workspace */}
          <main className={`${mobileView === "assistant" ? "flex" : "hidden"} lg:flex flex-1 flex-col h-full relative overflow-hidden bg-white`}>

            {/* Downgrade Notification Toast */}
            {downgradeNotice && (
              <div className="mx-5 sm:mx-7 mt-5 rounded-2xl bg-[#FFF8E1] border border-[#FFECB3] p-4 shadow-xs flex items-center justify-between gap-3 animate-slide-up">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FFE0B2] flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} className="text-[#E64A19]" />
                  </div>
                  <div>
                    <p className="font-bold text-[14px] text-[#1D2633] font-[Space_Grotesk,sans-serif]">
                      Daily Limit Reached for {downgradeNotice.fromLabel} OR high tier traffic
                    </p>
                    <p className="text-[13px] text-[#69688D]">
                      Switched automatically to <span className="font-bold text-[#1D2633]">{downgradeNotice.toLabel}</span> for this response.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDowngradeNotice(null)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#FFECB3] text-[#1D2633] hover:bg-[#FAFAFA] text-[12px] font-bold shadow-xs transition-all shrink-0 active:scale-95"
                >
                  Got it
                </button>
              </div>
            )}
            
            {isCenterLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[3px] transition-all duration-300">
                <PremiumLoader text={loadingAssist ? "Distilling insights" : "Processing conversation"} />
              </div>
            )}

              <div
                className={`pt-3 px-5 pb-5 sm:pt-4 sm:px-7 sm:pb-7 lg:pt-5 lg:px-10 lg:pb-10 flex-1 min-h-0 flex flex-col transition-all duration-500 ${
                  chatMode
                    ? "overflow-hidden"
                    : "overflow-y-auto custom-scrollbar"
                } ${
                  isCenterLoading
                    ? "blur-md opacity-40 pointer-events-none scale-[0.98]"
                    : ""
                }`}
              >

              {/* Requirement 2: Dedicated Chat Workspace UI when Chat Mode is active */}
              {chatMode ? (
                <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center my-auto text-center px-4 py-12 animate-slide-up">
                      <div className="w-16 h-16 bg-[#568FBD]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#568FBD]/20">
                        <MessageSquare size={28} className="text-[#568FBD]" />
                      </div>
                      <h3 className="text-[20px] font-bold text-[#1D2633] font-[Space_Grotesk,sans-serif] mb-1">
                        Cognivo Chat Mode
                      </h3>
                      <p className="text-[#69688D] text-[14.5px] max-w-[360px]">
                        Ask questions, request examples, attach files, or clarify session topics conversationally.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto custom-scrollbar space-y-4 pb-4 pr-2">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            msg.sender === "user" ? "items-end" : "items-start"
                          } animate-slide-up`}
                        >
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[11px] font-bold text-[#69688D]">
                              {msg.sender === "user" ? "You" : "Cognivo AI"}
                            </span>

                            <span className="text-[10px] text-[#69688D]/60">
                              {msg.timestamp}
                            </span>
                          </div>

                          <div
                            className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-[14.5px] leading-relaxed ${
                              msg.sender === "user"
                                ? "bg-[#1D2633] text-white rounded-br-xs shadow-sm"
                                : "bg-[#FAFAFA] border border-[#1D2633]/10 text-[#1D2633] rounded-bl-xs shadow-xs"
                            }`}
                          >
                            {msg.files && msg.files.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {msg.files.map((fn, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/20 text-white font-medium"
                                  >
                                    <FileText size={12} />
                                    {fn}
                                  </span>
                                ))}
                              </div>
                            )}

                            <p>{msg.text}</p>

                            {msg.keyPoints && msg.keyPoints.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#1D2633]/10 space-y-1.5">
                                <p className="font-bold text-[12px] uppercase text-[#568FBD]">
                                  Key Points
                                </p>

                                {msg.keyPoints.map((kp, kIdx) => (
                                  <div
                                    key={kIdx}
                                    className="flex items-start gap-2 text-[13.5px]"
                                  >
                                    <Check
                                      size={14}
                                      className="mt-1 text-[#568FBD] shrink-0"
                                    />
                                    <span>{kp}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {loadingContextQuery && (
                        <div className="flex items-center gap-2 px-1 pt-1 animate-slide-up">
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAFAFA] border border-[#1D2633]/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#568FBD] animate-pulse" />
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#568FBD] animate-pulse"
                              style={{ animationDelay: "150ms" }}
                            />
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#568FBD] animate-pulse"
                              style={{ animationDelay: "300ms" }}
                            />
                            <span className="text-[12px] text-[#69688D] ml-1">
                              Cognivo is thinking
                            </span>
                          </div>
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>
              ) : (
                /* Normal Mode: Chrome-style Tab Interface */
                <div className="flex-1 flex flex-col">
                  {!assistResult ? (
                    <div className="flex flex-col items-center justify-center my-auto translate-y-8 text-center px-4 py-16 animate-slide-up">
                      <div className="w-20 h-20 bg-[#1D2633]/5 rounded-full flex items-center justify-center mb-6 border-2 border-[#1D2633]/10 relative animate-float-slow">
                        <Sparkles size={32} className="text-[#1D2633] opacity-60" strokeWidth={1.5} />
                      </div>
                      <h2 className="text-[24px] sm:text-[28px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] mb-2 tracking-tight">
                        Ready to listen
                      </h2>
                      <p className="text-[#69688D] text-[15px] sm:text-[16px] max-w-[280px]">
                        Click Start Listening to begin recording transcription.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-6">
                      
                      {/* Requirements 7 & 8: Chrome-Style Tab Bar */}
                      <div className="border-b border-[#1D2633]/10 flex items-stretch gap-0.5 sm:gap-1 w-full">
                        <button
                          onClick={() => setActiveTab("simplified")}
                          className={`flex-none min-w-[86px] sm:min-w-0 px-2 sm:px-4 py-2.5 rounded-t-xl font-bold text-[11.5px] sm:text-[13.5px] transition-all flex items-center justify-center sm:justify-start gap-1 sm:gap-2 border-t border-x ${
                            activeTab === "simplified"
                              ? "bg-white border-[#1D2633]/15 text-[#1D2633] shadow-xs -mb-px z-10"
                              : "bg-[#FAFAFA] border-transparent text-[#69688D] hover:bg-[#F0F2F5] hover:text-[#1D2633]"
                          }`}
                        >
                          <Sparkles size={15} className={`shrink-0 ${activeTab === "simplified" ? "text-[#568FBD]" : "text-[#69688D]"}`} />
                          <span className="whitespace-nowrap">Simplified</span>
                        </button>

                        <button
                          onClick={() => setActiveTab("keyPoints")}
                          className={`flex-none min-w-[82px] sm:min-w-0 px-2 sm:px-4 py-2.5 rounded-t-xl font-bold text-[11.5px] sm:text-[13.5px] transition-all flex items-center justify-center sm:justify-start gap-1 sm:gap-2 border-t border-x ${
                            activeTab === "keyPoints"
                              ? "bg-white border-[#1D2633]/15 text-[#1D2633] shadow-xs -mb-px z-10"
                              : "bg-[#FAFAFA] border-transparent text-[#69688D] hover:bg-[#F0F2F5] hover:text-[#1D2633]"
                          }`}
                        >
                          <Check size={15} className={`shrink-0 ${activeTab === "keyPoints" ? "text-[#568FBD]" : "text-[#69688D]"}`} />
                          <span className="whitespace-nowrap">Points</span>
                          {assistResult?.keyPoints?.length > 0 && (
                            <span className="ml-0.5 sm:ml-1 shrink-0 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-[#1D2633]/10 text-[#1D2633]">
                              {assistResult.keyPoints.length}
                            </span>
                          )}
                        </button>

                        {hasSteps && (
                          <button
                            onClick={() => setActiveTab("steps")}
                            className={`flex-none min-w-[78px] sm:min-w-0 px-2 sm:px-4 py-2.5 rounded-t-xl font-bold text-[11.5px] sm:text-[13.5px] transition-all flex items-center justify-center sm:justify-start gap-1 sm:gap-2 border-t border-x ${
                              activeTab === "steps"
                                ? "bg-white border-[#1D2633]/15 text-[#1D2633] shadow-xs -mb-px z-10"
                                : "bg-[#FAFAFA] border-transparent text-[#69688D] hover:bg-[#F0F2F5] hover:text-[#1D2633]"
                            }`}
                          >
                            <BookOpen size={15} className={`shrink-0 ${activeTab === "steps" ? "text-[#568FBD]" : "text-[#69688D]"}`} />
                            <span className="whitespace-nowrap">Steps</span>
                          </button>
                        )}

                        {hasVisuals && (
                          <button
                            onClick={() => setActiveTab("visuals")}
                            className={`flex-none min-w-[82px] sm:min-w-0 px-2 sm:px-4 py-2.5 rounded-t-xl font-bold text-[11.5px] sm:text-[13.5px] transition-all flex items-center justify-center sm:justify-start gap-1 sm:gap-2 border-t border-x ${
                              activeTab === "visuals"
                                ? "bg-white border-[#1D2633]/15 text-[#1D2633] shadow-xs -mb-px z-10"
                                : "bg-[#FAFAFA] border-transparent text-[#69688D] hover:bg-[#F0F2F5] hover:text-[#1D2633]"
                            }`}
                          >
                            <BrainCircuit size={15} className={`shrink-0 ${activeTab === "visuals" ? "text-[#568FBD]" : "text-[#69688D]"}`} />
                            <span className="whitespace-nowrap">Visuals</span>
                          </button>
                        )}
                      </div>

                      {/* Tab Content Display */}
                      <div className="py-2 animate-slide-up relative z-20">
                        
                        {/* TAB 1: SIMPLIFIED */}
                        {activeTab === "simplified" && assistResult._rawSimplified && (
                          <div className="space-y-4">
                            {hasSpeakers ? (
                              assistResult.speakerSegments.map((seg, i) => (
                                <div key={i} className="group flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[#1D2633] text-[14px] font-[Space_Grotesk,sans-serif]">
                                      {seg.speaker}
                                    </span>
                                    {seg.tone && seg.tone !== "neutral" && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-[0.1em] border ${getToneColor(seg.tone)}`}>
                                        {seg.tone}
                                      </span>
                                    )}
                                  </div>
                                  <div className="pl-3 sm:pl-4 border-l-2 border-[#1D2633]/10 group-hover:border-[#76A7C9]/40 transition-colors">
                                    <p className="text-[15px] sm:text-[16px] text-[#1D2633] leading-[1.65]">
                                      {renderTextWithHighlights(seg.text, simplifiedDone)}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[16px] sm:text-[18px] text-[#1D2633] leading-[1.7] max-w-[42rem]">
                                <span>
                                  {renderTextWithHighlights(
                                    simplifiedDone ? assistResult._rawSimplified : animatedSimplified,
                                    true
                                  )}
                                </span>
                              </p>
                            )}
                          </div>
                        )}

                        {/* TAB 2: KEY POINTS */}
                        {activeTab === "keyPoints" && assistResult.keyPoints?.length > 0 && (
                          <div className="grid gap-2.5 max-w-[42rem]">
                            {assistResult.keyPoints.map((p, i) => (
                              <div key={i} className="flex items-start gap-3 bg-[#FAFAFA] p-3.5 sm:p-4 rounded-xl border border-[#1D2633]/5 hover:border-[#1D2633]/15 transition-colors">
                                <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[#1D2633]/5 text-[#1D2633] mt-0.5">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                                <span className="text-[#1D2633] text-[15px] leading-relaxed">{renderTextWithHighlights(p, simplifiedDone)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* TAB 3: STEPS */}
                        {activeTab === "steps" && hasSteps && (
                          <div className="space-y-2.5 max-w-[42rem]">
                            {assistResult.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-3 bg-[#FAFAFA] p-3.5 sm:p-4 rounded-xl border border-[#1D2633]/5 hover:border-[#1D2633]/15 transition-colors">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-[#1D2633] text-white text-[12px] font-bold font-[Space_Grotesk,sans-serif]">
                                  {i + 1}
                                </span>
                                <span className="text-[#1D2633] text-[15px] leading-relaxed pt-0.5">{renderTextWithHighlights(step, simplifiedDone)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* TAB 4: VISUALS */}
                        {activeTab === "visuals" && (
                          <div>
                            {loadingMermaid ? (
                              <div className="flex items-center gap-2 text-[13px] text-[#69688D] italic font-medium animate-pulse">
                                <Sparkles size={14} className="text-[#76A7C9]" />
                                Generating visual diagram…
                              </div>
                            ) : mermaidDiagram ? (
                              <div className="w-full max-w-full p-4 rounded-2xl border border-[#1D2633]/10 bg-[#FAFAFA] shadow-xs">
                                <MermaidDiagram diagram={mermaidDiagram} />
                              </div>
                            ) : null}
                          </div>
                        )}

                      </div>

                      {/* "I Understand" Session Verification */}
                      {selectedSessionId && (
                        <div className="pt-4 border-t border-[#1D2633]/10 animate-slide-up">
                          <button
                            onClick={openQuiz}
                            className="bg-[#1D2633] hover:bg-[#29344a] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 text-[14px]"
                          >
                            <Check size={18} />
                            I Understand
                          </button>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Requirement 2 & 4: Context Query / Chat Bar */}
            <div className="bg-white border-t border-[#1D2633]/5 mt-15 p-4 sm:px-7 shrink-0 z-20">
              <input
                id="context-file-input"
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
              />

              {/* Multi-file UI handling (Max 2 files) */}
              {attachedFiles.length > 0 && (
                <div className="w-full max-w-[52rem] mx-auto mb-2.5 flex flex-wrap gap-2 items-center">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#F5F7F8] border border-[#1D2633]/10 rounded-lg px-3 py-1.5 max-w-[260px]">
                      <FileText size={14} className="text-[#568FBD] shrink-0" />
                      <span className="text-[12.5px] font-medium text-[#1D2633] truncate">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(idx)}
                        className="text-[#69688D] hover:text-[#1D2633] transition-colors p-0.5 ml-auto"
                        title="Remove file"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {attachedFiles.length < 2 && (
                    <span className="text-[11px] text-[#69688D] italic">
                      (1 more file can be attached)
                    </span>
                  )}
                </div>
              )}
              
              <div className="w-full max-w-[52rem] min-w-0 mx-auto flex items-center gap-1 lg:gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (attachedFiles.length >= 2) {
                      alert("Maximum 2 files allowed per message.");
                      return;
                    }
                    document.getElementById("context-file-input")?.click();
                  }}
                  disabled={loadingContextQuery || (!assistResult && !chatMode)}
                  className="flex-shrink-0 w-10 h-10 lg:w-[48px] lg:h-[48px] rounded-xl bg-[#FAFAFA] border-2 border-[#1D2633]/10 text-[#1D2633] flex items-center justify-center hover:border-[#76A7C9] hover:bg-[#F7F9FA] hover:text-[#568FBD] disabled:opacity-40 transition-all"
                  title="Attach file (Max 2)"
                >
                  <Plus
                    size={18}
                    strokeWidth={2.5}
                    className="lg:w-[21px] lg:h-[21px]"
                  />
                </button>

                {/* NEW LANGUAGE DROPDOWN */}
                <div ref={languageDropdownRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setIsLanguageDropdownOpen((prev) => !prev)
                    }
                    className="h-10 lg:h-[48px] min-w-[76px] max-w-[88px] sm:min-w-[100px] sm:max-w-[120px] lg:min-w-[145px] lg:max-w-[170px] flex items-center justify-between gap-1 lg:gap-2 bg-[#FAFAFA] border-2 border-[#1D2633]/10 rounded-xl px-2 lg:px-3 text-[11px] sm:text-[12.5px] lg:text-[13.5px] font-bold text-[#1D2633] hover:border-[#76A7C9] focus:outline-none transition-all shrink-0"
                  >
                    <span className="truncate">
                      {centerLanguage}
                    </span>

                    <ChevronDown
                      size={15}
                      className={`shrink-0 text-[#69688D] transition-transform duration-200 ${
                        isLanguageDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isLanguageDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-[220px] bg-white border border-[#1D2633]/10 rounded-2xl shadow-xl z-[100] p-2 animate-slide-up">
                      <div className="max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                        {CENTER_LANGUAGES.map((language) => {
                          const isSelected = centerLanguage === language.label;

                          return (
                            <button
                              key={language.code}
                              type="button"
                              onClick={() => {
                                setCenterLanguage(language.label);
                                setIsLanguageDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left text-[13px] transition-all ${
                                isSelected
                                  ? "bg-[#1D2633] text-white"
                                  : "text-[#1D2633] hover:bg-[#F5F7F8]"
                              }`}
                            >
                              <span className="truncate">{language.label}</span>

                              {isSelected && (
                                <Check
                                  size={15}
                                  className="shrink-0 text-white"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={contextQuery}
                  onChange={(e) => setContextQuery(e.target.value)}
                  placeholder={
                    chatMode
                      ? "Type a message or prompt Cognivo..."
                      : "Ask for clarification, examples, or simpler terms..."
                  }
                  disabled={!assistResult && !chatMode}
                  className="flex-1 min-w-0 w-full h-10 lg:h-auto bg-[#FAFAFA] border-2 border-[#1D2633]/10 rounded-xl px-3 lg:px-4 py-0 lg:py-3 text-[13px] lg:text-[14.5px] text-[#1D2633] placeholder:text-[#69688D]/50 focus:outline-none focus:border-[#76A7C9] focus:ring-4 focus:ring-[#76A7C9]/20 transition-all disabled:opacity-60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContextQuery();
                  }}
                />
              <button
                onClick={handleContextQuery}
                disabled={loadingContextQuery || (!assistResult && !chatMode)}
                className="flex-shrink-0 w-10 h-10 lg:w-auto lg:h-auto lg:px-5 lg:sm:px-6 py-0 lg:py-3 rounded-xl bg-[#1D2633] text-white font-bold text-[13px] lg:text-[14.5px] shadow-md shadow-[#1D2633]/15 transition-all hover:bg-[#29344a] hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="hidden sm:inline">
                  {chatMode ? "Send" : "Ask"}
                </span>
                <ArrowRight size={18} className="sm:hidden" />
              </button>
              </div>
            </div>
          </main>

          {/* Right Column: Controls Sidebar */}
          <aside className={`${mobileView === "controls" ? "flex flex-1 min-h-0 overflow-y-auto" : "hidden"} lg:flex w-full lg:w-[280px] xl:w-[320px] lg:max-h-none lg:overflow-hidden custom-scrollbar bg-[#FAFAFA] border-t lg:border-t-0 lg:border-l border-[#1D2633]/5 flex-col lg:shrink-0`}>
            <div className="p-5 sm:p-7 pt-3 sm:pt-4 flex flex-col gap-4 flex-1">
              
              {/* Primary Action Button */}
              <div className="hidden lg:block">
                <button
                  onClick={recording ? stopRecording : handleStartListening}
                  disabled={!recording && chatMode}
                  className={`group flex items-center justify-center gap-2.5 w-full py-[17px] rounded-[1rem] font-bold text-[16px] transition-all duration-300 ${
                    recording
                      ? "bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100 shadow-xs"
                      : chatMode
                      ? "bg-[#F1F2F4] text-[#9AA0AA] border-2 border-[#1D2633]/5 cursor-not-allowed"
                      : "bg-[#1D2633] text-white shadow-lg shadow-[#1D2633]/20 hover:bg-[#29344a] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
                  }`}
                  title={chatMode ? "Disable Chat Mode to start listening" : ""}
                >
                  {recording ? (
                    <>
                      <Square size={18} fill="currentColor" className="animate-pulse" />
                      <span>Stop Listening</span>
                    </>
                  ) : (
                    <>
                      <Mic size={18} />
                      <span>{chatMode ? "Listening Disabled" : "Start Listening"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preferences & Navigation */}
              <div className="space-y-4">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-[#69688D]">Preferences</h3>
                
                <div className="space-y-2">
                  {/* Requirement 2: Renamed to Chat Mode */}
                  <label className="group flex items-center justify-between p-3.5 rounded-xl border-2 border-[#1D2633]/10 bg-white hover:border-[#1D2633]/30 hover:bg-[#1D2633]/[0.02] cursor-pointer transition-all">
                    <span className="text-[14px] font-medium text-[#1D2633] transition-colors">Chat Mode</span>
                    <div className={`flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all ${
                      chatMode ? "bg-[#1D2633] border-[#1D2633]" : "border-[#1D2633]/20"
                    }`}>
                      <Check size={12} className={`text-white stroke-[4] transition-opacity ${chatMode ? "opacity-100" : "opacity-0"}`} />
                    </div>
                    <input
                      type="checkbox"
                      checked={chatMode}
                      onChange={(e) => {
                        setChatMode(e.target.checked);
                        if (e.target.checked) setMobileView("assistant");
                      }}
                      className="hidden"
                    />
                  </label>

                  <label className="group flex items-center justify-between p-3.5 rounded-xl border-2 border-[#1D2633]/10 bg-white hover:border-[#1D2633]/30 hover:bg-[#1D2633]/[0.02] cursor-pointer transition-all">
                    <span className="text-[14px] font-medium text-[#1D2633] transition-colors">Visual aids</span>
                    <div className={`flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all ${
                      allowVisuals ? "bg-[#1D2633] border-[#1D2633]" : "border-[#1D2633]/20"
                    }`}>
                      <Check size={12} className={`text-white stroke-[4] transition-opacity ${allowVisuals ? "opacity-100" : "opacity-0"}`} />
                    </div>
                    <input type="checkbox" checked={allowVisuals} onChange={(e) => setAllowVisuals(e.target.checked)} className="hidden" />
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setMobileView("assistant");
                      handleIDontUnderstand();
                    }}
                    disabled={!selectedSessionId || loadingAssist}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-[14px] transition-all duration-300 border-2 border-[#1D2633]/10 bg-white text-[#1D2633] hover:border-[#1D2633]/30 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95"
                  >
                    <HelpCircle size={16} />
                    I Don't Understand
                  </button>
                  {!selectedSessionId && (
                    <p className="text-[11.5px] text-[#69688D] mt-2 text-center leading-tight">
                      Select a transcription session from the left panel.
                    </p>
                  )}
                </div>

<div className="pt-1 min-h-0">
  <div className="flex items-center justify-between mb-2.5">
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#69688D]">
        {selectedSession
          ? `Replay Minute ${sessions.findIndex((s) => s.id === selectedSession.id) + 1}`
          : "Text-To-Speech"}
      </h4>
    </div>
  </div>

  <div className="rounded-2xl border border-[#1D2633]/8 bg-white shadow-sm overflow-visible">
    <TranscriptPlayer
      segments={selectedSession ? activeSpeakerSegments : null}
      moduleText={
        selectedSession
          ? activeSpeakerSegments
            ? undefined
            : selectedSession.text
          : ""
      }
      profileId={profileId || "default_user"}
      buildApiUrl={buildApiUrl}
      onSyncWords={setTtsWords}
      onSyncActiveIdx={setTtsActiveIdx}
      onLoadingChange={setTtsLoading}
    />
  </div>

  {ttsLoading && (
    <div className="mt-2.5 flex items-center justify-center gap-2 text-[11px] text-[#69688D]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#568FBD] animate-pulse" />
      <span>Preparing audio…</span>
    </div>
  )}
</div>
              </div>

            </div>
          </aside>
        </div>

        {/* Requirement 15: Legal / AI Disclaimer Footer */}
        <footer className="py-2.5 px-3 text-center text-[10.5px] sm:text-[11.5px] text-[#69688D]/70 border-t border-[#1D2633]/5 bg-white font-medium shrink-0 leading-tight">
          <span className="lg:hidden">
            © 2026 Cognivo · AI may make mistakes · Powered by Gemini
          </span>

          <span className="hidden lg:inline">
            © 2026 Cognivo · AI-generated content may contain errors · Powered by Gemini
          </span>
        </footer>
      </div>

      {/* Requirement 1 & 14: Onboarding Answer Editor Modal */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1D2633]/40 backdrop-blur-xs p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-7 animate-slide-up relative border border-[#1D2633]/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[19px] font-bold text-[#1D2633] font-[Space_Grotesk,sans-serif]">
                Onboarding Preferences
              </h3>
              <button
                onClick={() => setIsOnboardingOpen(false)}
                className="text-[#69688D] hover:text-[#1D2633] p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-[13.5px] text-[#69688D] mb-5 leading-normal">
              Review or customize the preferences provided during your initial setup.
            </p>

            {/* Replace the inputs inside the isOnboardingOpen modal with these: */}
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#69688D] mb-1">
                  Where do you lose understanding?
                </label>
                <select
                  value={tempOnboarding.comprehensionBreak}
                  onChange={(e) => setTempOnboarding({ ...tempOnboarding, comprehensionBreak: e.target.value })}
                  className="w-full bg-[#FAFAFA] border border-[#1D2633]/15 rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D2633] focus:outline-none focus:border-[#76A7C9]"
                >
                  <option value="miss_key_terms">I miss key terms</option>
                  <option value="lose_connection">I lose connection between ideas</option>
                  <option value="forget_steps">I forget earlier steps</option>
                  <option value="overwhelmed_speed">Things move too fast</option>
                  <option value="cant_retain">I understand but can’t retain</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#69688D] mb-1">
                  What helps you understand best?
                </label>
                <select
                  value={tempOnboarding.learningPreference}
                  onChange={(e) => setTempOnboarding({ ...tempOnboarding, learningPreference: e.target.value })}
                  className="w-full bg-[#FAFAFA] border border-[#1D2633]/15 rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D2633] focus:outline-none focus:border-[#76A7C9]"
                >
                  <option value="simple_words">Simpler words</option>
                  <option value="examples">Practical examples</option>
                  <option value="step_by_step">Step-by-step breakdown</option>
                  <option value="visuals">Visual explanations</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#69688D] mb-1">
                  Which thought happens more often?
                </label>
                <select
                  value={tempOnboarding.listeningThought}
                  onChange={(e) => setTempOnboarding({ ...tempOnboarding, listeningThought: e.target.value })}
                  className="w-full bg-[#FAFAFA] border border-[#1D2633]/15 rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D2633] focus:outline-none focus:border-[#76A7C9]"
                >
                  <option value="missed_what_was_said">"Wait… what did they just say?"</option>
                  <option value="hear_but_not_understand">"I get the words, but not the meaning"</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#69688D] mb-1">
                  One thing you struggle with
                </label>
                <input
                  type="text"
                  value={tempOnboarding.struggleNote}
                  onChange={(e) => setTempOnboarding({ ...tempOnboarding, struggleNote: e.target.value })}
                  className="w-full bg-[#FAFAFA] border border-[#1D2633]/15 rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D2633] focus:outline-none focus:border-[#76A7C9]"
                  placeholder="Example: Fast speakers..."
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#69688D] mb-1">
                  Reading font
                </label>
                <select
                  value={tempOnboarding.uiPreferences?.font || "Atkinson Hyperlegible"}
                  onChange={(e) => setTempOnboarding({
                    ...tempOnboarding,
                    uiPreferences: { ...tempOnboarding.uiPreferences, font: e.target.value }
                  })}
                  className="w-full bg-[#FAFAFA] border border-[#1D2633]/15 rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D2633] focus:outline-none focus:border-[#76A7C9]"
                >
                  {["Atkinson Hyperlegible", "OpenDyslexic", "Lexend", "Arial"].map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[#1D2633]/10">
              <button
                onClick={() => setIsOnboardingOpen(false)}
                className="px-4 py-2 rounded-xl text-[13.5px] font-bold text-[#69688D] hover:bg-[#FAFAFA] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveOnboardingProfile}
                className="px-5 py-2 rounded-xl text-[13.5px] font-bold text-white bg-[#1D2633] hover:bg-[#29344a] shadow-sm transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Verification Modal */}
      {quizState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1D2633]/40 backdrop-blur-xs p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-slide-up relative border border-[#1D2633]/10">
            <h3 className="text-[20px] font-bold text-[#1D2633] mb-2 font-[Space_Grotesk,sans-serif]">Verify Understanding</h3>
            <p className="text-[15px] text-[#69688D] mb-6">Answer this question about what you just read to mark it as understood.</p>

            {quizState.status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-8 h-8 rounded-full border-[3px] border-[#1D2633]/10 border-t-[#568FBD] animate-spin" />
                <span className="text-[13.5px] text-[#69688D] font-medium">Writing a question about this session…</span>
              </div>
            )}

            {quizState.status === 'error' && (
              <div className="py-6">
                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-[14px] font-medium mb-4">
                  Couldn't generate a question right now.
                </div>
                <button
                  onClick={openQuiz}
                  className="w-full py-3 rounded-xl font-bold text-[14px] text-white bg-[#1D2633] hover:bg-[#29344a] transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

            {(quizState.status === 'idle' || quizState.status === 'wrong') && quizData && (
              <>
                <div className="bg-[#FAFAFA] border border-[#1D2633]/10 p-4 rounded-xl mb-6">
                  <p className="text-[14.5px] font-medium text-[#1D2633]">{quizData.question}</p>
                </div>

                <div className="space-y-3">
                  {quizData.options.map((opt, idx) => (
                    <button
                      key={opt.id}
                      onClick={() => handleQuizAnswer(opt.id)}
                      className="w-full text-left p-4 rounded-xl border-2 border-[#1D2633]/10 hover:border-[#76A7C9] hover:bg-[#F0F6FA] transition-all text-[14.5px] text-[#1D2633] font-medium"
                    >
                      {String.fromCharCode(65 + idx)}. {opt.text}
                    </button>
                  ))}
                </div>

                {quizState.status === 'wrong' && (
                  <div className="mt-5 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-[14px] font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-up">
                    <span>Not quite. Take another look at the explanation.</span>
                    <button
                      onClick={handleReviewAgain}
                      className="font-bold whitespace-nowrap px-4 py-2 bg-white rounded-lg shadow-xs hover:shadow active:scale-95 transition-all text-red-700"
                    >
                      Re-read
                    </button>
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => { setQuizState({ isOpen: false, status: 'idle' }); setQuizData(null); }}
              className="absolute top-4 right-4 text-[#69688D] hover:text-[#1D2633] transition-colors p-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Sticky Recording Button */}
      <div className="lg:hidden sticky bottom-0 bg-[#E3E2D9] px-3 pt-2 pb-2 sm:pb-safe z-50">
        <button
          onClick={() => {
            if (recording) {
              stopRecording();
            } else {
              setMobileView("transcript");
              handleStartListening();
            }
          }}
          disabled={!recording && chatMode}
          className={`group flex items-center justify-center gap-2.5 w-full py-[16px] rounded-[1rem] font-bold text-[16px] transition-all duration-300 ${
            recording
              ? "bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100 shadow-xs"
              : chatMode
              ? "bg-[#F1F2F4] text-[#9AA0AA] border-2 border-[#1D2633]/5 cursor-not-allowed"
              : "bg-[#1D2633] text-white shadow-lg shadow-[#1D2633]/20 hover:bg-[#29344a] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
          }`}
          title={chatMode ? "Disable Chat Mode to start listening" : ""}
        >
          {recording ? (
            <>
              <Square size={18} fill="currentColor" className="animate-pulse" />
              <span>Stop Listening</span>
            </>
          ) : (
            <>
              <Mic size={18} />
              <span>{chatMode ? "Listening Disabled" : "Start Listening"}</span>
            </>
          )}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D0D4DB; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #69688D; }

        @keyframes noiseToast {
          0% {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          12% {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -6px);
          }
        }

        .animate-noise-toast {
          animation: noiseToast 4.5s ease-in-out forwards;
        }
        
        @keyframes slideUpFade {
          0% { opacity: 0; transform: translateY(12px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-up {
          animation: slideUpFade 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes floatSlow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(0, -8px); }
        }
        .animate-float-slow {
          animation: floatSlow 6s ease-in-out infinite;
        }

        .loading-dots::after {
          content: '';
          animation: dots 1.5s steps(4, end) infinite;
        }
        @keyframes dots {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }

        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #1D2633;
          cursor: pointer;
          margin-top: -5px;
          box-shadow: 0 2px 4px rgba(29,38,51,0.2);
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 6px;
          cursor: pointer;
          border-radius: 9999px;
        }

        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 16px); }
      `}} />
    </div>
  );
};

export default Dashboard;