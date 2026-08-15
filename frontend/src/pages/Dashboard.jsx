import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestAssist } from "../services/assist.api.js";
import { useTypewriter } from "../hooks/useTypewriter.js";
import MermaidDiagram from "../components/MermaidDiagram";

import {
  Settings,
  HelpCircle,
  User,
  Pause,
  Play,
  RotateCcw,
  Mic,
  Square,
  Sparkles,
  Check,
  ChevronDown,
  ArrowRight,
  AlertTriangle,
  Plus
} from "lucide-react";

// Updated to use soft, complementary UI tones that fit the new aesthetic
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

const DEFAULT_API_BASE_URL = "http://localhost:3000/api";

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  const resolved = configured && typeof configured === "string"
    ? configured
    : DEFAULT_API_BASE_URL;
  return resolved.replace(/\/+$/, "");
}

function buildApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${cleanPath}`;
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

function truncateLabel(text, maxWords = 6, maxChars = 50) {
  if (!text || typeof text !== "string") return "";

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const words = normalized.split(" ").filter(Boolean);
  const byWord = words.slice(0, maxWords).join(" ");
  const clipped = byWord.length > maxChars
    ? `${byWord.slice(0, maxChars - 1).trim()}...`
    : byWord;

  return clipped.replace(/"/g, "'");
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

  const lines = ["flowchart LR"];

  chunks.forEach((label, index) => {
    lines.push(`N${index}["\`${label}\`"]`);
  });

  for (let i = 1; i < chunks.length; i += 1) {
    lines.push(`N${i - 1} --> N${i}`);
  }

  return lines.join("\n");
}

const Dashboard = () => {
  const [profileId, setProfileId] = useState(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(50);
  const [selectedModel, setSelectedModel] = useState("default");

  const [contextQuery, setContextQuery] = useState("");
  const [loadingContextQuery, setLoadingContextQuery] = useState(false);

  const [attachedFile, setAttachedFile] = useState(null);

  const [mermaidDiagram, setMermaidDiagram] = useState(null);
  const [loadingMermaid, setLoadingMermaid] = useState(false);

  const [transcriptChunk, setTranscriptChunk] = useState("");
  const [assistResult, setAssistResult] = useState(null);
  const [loadingAssist, setLoadingAssist] = useState(false);

  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  
  const audioChunksRef = React.useRef([]);
  const mediaStreamRef = React.useRef(null);
  const monitorContextRef = React.useRef(null);
  const monitorSourceRef = React.useRef(null);

  const navigate = useNavigate();

  const animationDelay = Math.max(20, 200 - speed * 1.8);

  const usedHardWordsRef = React.useRef(new Set());

  const [textOnly, setTextOnly] = useState(true);
  const [allowVisuals, setAllowVisuals] = useState(true);

  const hasSpeakers =
    Array.isArray(assistResult?.speakerSegments) &&
    assistResult.speakerSegments.length >= 2;

  const {
    text: animatedSimplified,
    done: simplifiedDone
  } = useTypewriter(
    assistResult?._rawSimplified || "",
    animationDelay,
    paused
  );

  const normalizeHardWords = (hardWords = {}) => {
    const entries = Object.entries(hardWords);
    entries.sort((a, b) => b[0].length - a[0].length);
    return entries.map(([word, description]) => ({
      word,
      description,
      used: false
    }));
  };

  const animationDone = 
    animatedSimplified === assistResult?._rawSimplified;

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
        return (
          <span
            key={i}
            className="relative group text-[#568FBD] font-semibold underline decoration-dotted decoration-[#568FBD]/50 cursor-help transition-colors hover:text-[#76A7C9]"
          >
            {part}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1D2633] text-white text-[12.5px] px-3.5 py-2.5 rounded-xl shadow-[0_12px_24px_-8px_rgba(29,38,51,0.3)] z-50 w-60 text-center leading-snug normal-case font-normal animate-slide-up font-[Atkinson_Hyperlegible,sans-serif]">
              {hardWordsMap[originalKey]}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1D2633]"></div>
            </span>
          </span>
        );
      }

      return part;
    });
  };

  const handleContextQuery = async () => {
    if (!contextQuery.trim() || !assistResult || !profileId) return;

    try {
      setLoadingContextQuery(true);

      const res = await fetch(buildApiUrl("/assist/context"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          query: contextQuery,
          previousResult: assistResult,
          model: selectedModel, // Model safely passed to existing backend structure
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();

      setAssistResult({
        ...data,
        _rawSimplified: data.simplified,
      });

      setContextQuery("");
      usedHardWordsRef.current.clear();
    } catch (err) {
      console.error("Context query failed:", err);
      alert("AI could not process the request");
    } finally {
      setLoadingContextQuery(false);
    }
  };

  useEffect(() => {
    const id = localStorage.getItem("aurasync_profile_id");
    setProfileId(id);
  }, []);

  const resetProfile = () => {
    localStorage.removeItem("aurasync_profile_id");
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (assistResult) {
      usedHardWordsRef.current.clear();
    }
  }, [assistResult]);

  useEffect(() => {
    if (!assistResult?.simplified) {
      setLoadingMermaid(false);
      setMermaidDiagram(null);
      return;
    }

    if (!allowVisuals) {
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
            userPreferences: {
              allowVisuals,
            },
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }

        const data = await res.json();
        const normalizedRemote = normalizeMermaidDiagram(data?.diagram);
        const finalDiagram =
          normalizedRemote && !isDiagramDense(normalizedRemote)
            ? normalizedRemote
            : fallbackDiagram;

        if (!cancelled) {
          setMermaidDiagram(finalDiagram || null);
        }
      } catch (err) {
        console.error("Mermaid auto-trigger failed", err);
        if (!cancelled) {
          setMermaidDiagram(fallbackDiagram || null);
        }
      } finally {
        if (!cancelled) setLoadingMermaid(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assistResult, allowVisuals]);

  const isExtensionContext = () =>
    typeof chrome !== "undefined" && Boolean(chrome?.runtime?.id);

  const cleanupCapturedAudio = async () => {
    try {
      if (monitorSourceRef.current) {
        monitorSourceRef.current.disconnect();
      }
    } catch (err) {
      console.warn("Failed to disconnect monitor source", err);
    } finally {
      monitorSourceRef.current = null;
    }

    try {
      if (monitorContextRef.current) {
        await monitorContextRef.current.close();
      }
    } catch (err) {
      console.warn("Failed to close monitor context", err);
    } finally {
      monitorContextRef.current = null;
    }

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
      if (context.state === "suspended") {
        await context.resume();
      }
      monitorContextRef.current = context;
      monitorSourceRef.current = source;
    } catch (err) {
      console.warn("Unable to mirror captured tab audio", err);
    }
  };

  const captureTabAudioStream = async () => {
    return new Promise((resolve, reject) => {
      if (!chrome?.tabCapture?.capture) {
        reject(new Error("tabCapture API unavailable"));
        return;
      }

      chrome.tabCapture.capture(
        { audio: true, video: false },
        async (stream) => {
          const runtimeError = chrome.runtime?.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }

          if (!stream) {
            reject(new Error("Failed to capture tab audio stream"));
            return;
          }

          await attachTabAudioMonitor(stream);
          resolve(stream);
        }
      );
    });
  };

  const getRecordingStream = async () => {
    if (isExtensionContext() && chrome?.tabCapture?.capture) {
      return captureTabAudioStream();
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
  };

  const getMediaRecorderOptions = () => {
    if (
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported("audio/webm")
    ) {
      return { mimeType: "audio/webm" };
    }
    if (
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ) {
      return { mimeType: "audio/webm;codecs=opus" };
    }
    return {};
  };

  const startRecording = async () => {
    try {
      const stream = await getRecordingStream();
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, getMediaRecorderOptions());
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error(err);
      alert(
        isExtensionContext()
          ? "Unable to capture live tab audio. Make sure audio is playing in the active tab."
          : "Unable to start microphone recording."
      );
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder) return;

    setRecording(false);

    mediaRecorder.onstop = async () => {
      try {
        const recorderType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: recorderType });
        const normalizedMimeType =
          (blob.type || recorderType || "audio/webm").split(";")[0] || "audio/webm";
        await cleanupCapturedAudio();

        if (blob.size === 0) {
          alert(
            isExtensionContext()
              ? "No tab audio captured. Play audio in the active tab and try again."
              : "No audio captured. Please speak and try again."
          );
          return;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(arrayBuffer);

        const onboardingRaw = localStorage.getItem("aurasync_profile");
        const parsedProfile = onboardingRaw ? JSON.parse(onboardingRaw) : null;
        const onboarding = parsedProfile?.onboarding || parsedProfile || {
          comprehensionBreak: "Long explanations are hard",
          learningPreference: "Step by step",
          listeningThought: "I lose focus quickly",
          struggleNote: "Technical lectures",
        };

        setLoadingAssist(true);

        const res = await fetch(buildApiUrl("/audio/process"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64Audio,
            mimeType: normalizedMimeType,
            userProfile: { onboarding },
            model: selectedModel, // Passed to backend smoothly
          }),
        });

        if (!res.ok) {
          const rawError = await res.text();
          let parsedError = rawError;
          try {
            const parsed = JSON.parse(rawError);
            parsedError = parsed?.error || rawError;
          } catch (_parseErr) {}
          throw new Error(parsedError || `Request failed (${res.status})`);
        }

        const data = await res.json();

        setTranscriptChunk(data.transcript);
        setAssistResult({
          ...data.aiResult,
          _rawSimplified: data.aiResult.simplified,
        });
        usedHardWordsRef.current.clear();
      } catch (err) {
        console.error(err);
        alert(`Audio processing failed: ${err?.message || "Unknown error"}`);
      } finally {
        setLoadingAssist(false);
        setMediaRecorder(null);
        audioChunksRef.current = [];
      }
    };

    mediaRecorder.stop();
  };

  useEffect(() => {
    return () => {
      cleanupCapturedAudio().catch((err) => {
        console.warn("Failed to cleanup audio capture on unmount", err);
      });
    };
  }, []);

  const handleAssistClick = async () => {
    if (!profileId || !transcriptChunk) return;
    try {
      setLoadingAssist(true);
      const data = await requestAssist({
        profileId,
        text: transcriptChunk,
        model: selectedModel // Passed downstream smoothly
      });

      setAssistResult({
        ...data,
        _rawSimplified: data.simplified
      });
      usedHardWordsRef.current.clear();
    } catch (err) {
      console.error(err);
      alert("Failed to get explanation");
    } finally {
      setLoadingAssist(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#E3E2D9] md:p-4 lg:p-6 flex flex-col font-[Atkinson_Hyperlegible,sans-serif] text-[#1D2633] antialiased">
      
      {/* Outer App Container */}
      <div className="flex-1 w-full max-w-[1300px] mx-auto bg-white flex flex-col relative md:rounded-[2rem] md:shadow-[0_24px_48px_-16px_rgba(29,38,51,0.14)] md:border border-[#1D2633]/10 overflow-hidden transition-all">
        
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 sm:px-7 sm:py-5 border-b border-[#1D2633]/5 bg-white z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/favicon-128.png" alt="Cognivo" className="h-7 w-7 rounded-full object-contain hidden sm:block" />
            <h1 className="text-[18px] sm:text-[20px] font-extrabold tracking-[0.16em] text-[#1D2633] uppercase font-[Space_Grotesk,sans-serif]">
              Cognivo
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Model Selector */}
            <div className="relative group flex items-center bg-white border border-[#1D2633]/10 rounded-xl px-2.5 py-1.5 sm:px-3 shadow-[0_2px_8px_rgba(29,38,51,0.06)] hover:border-[#76A7C9]/60 hover:shadow-[0_4px_12px_rgba(29,38,51,0.09)] transition-all duration-200">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="appearance-none bg-transparent outline-none text-[#1D2633] text-[12px] sm:text-[13.5px] font-semibold pr-6 cursor-pointer w-full"
              >
                <option value="default">Default Model</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </select>

              <ChevronDown
                size={14}
                strokeWidth={2.5}
                className="absolute right-2.5 text-[#69688D] pointer-events-none group-hover:text-[#568FBD] transition-colors"
              />
            </div>

            <div className="w-px h-5 bg-[#1D2633]/10 hidden sm:block"></div>

            <button
              onClick={resetProfile}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[12px] sm:text-[13.5px] font-bold text-[#1D2633] bg-[#F5F6F4] border border-[#1D2633]/10 shadow-sm hover:bg-[#EEF1F0] hover:border-[#1D2633]/20 hover:shadow-md active:scale-95 transition-all whitespace-nowrap"
            >
              <RotateCcw size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">New Session</span>
            </button>
          </div>
        </header>

        {/* Main Interface Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Column: AI Content Area */}
          <main className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar bg-white">
            <div className="p-5 sm:p-7 lg:p-10 flex-1">
              
              {assistResult?.noiseDetected && (
                <div className="mb-6 rounded-xl bg-[#FFF8E1] border border-[#FFECB3] px-4 py-3 text-[14px] text-[#F57C00] shadow-sm flex items-start gap-3 animate-slide-up">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span className="font-medium">Background noise was detected. Some sounds were ignored to preserve clarity.</span>
                </div>
              )}
              
              {assistResult ? (
                <div className="space-y-8 pb-20 lg:pb-8">
                  {/* Simplified Section */}
                  <div className="animate-slide-up">
                    <h2 className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#568FBD] mb-4 flex items-center gap-2">
                      <span className="w-6 h-[2px] bg-[#568FBD]"></span>
                      Simplified
                    </h2>
                    
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
                          <span key={`${speed}-${assistResult?._rawSimplified}`}>
                            {renderTextWithHighlights(
                              (paused && !simplifiedDone) || simplifiedDone
                                ? assistResult._rawSimplified
                                : animatedSimplified,
                              true
                            )}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Key Points */}
                  {assistResult.keyPoints?.length > 0 && (
                    <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                      <h2 className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#568FBD] mb-4 flex items-center gap-2">
                        <span className="w-6 h-[2px] bg-[#568FBD]"></span>
                        Key Points
                      </h2>
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
                    </div>
                  )}
                  
                  {/* Steps */}
                  {assistResult.flags?.multi_step && assistResult.steps?.length > 0 && (
                    <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
                      <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#76A7C9] mb-4 flex items-center gap-2">
                        <span className="w-6 h-px bg-[#76A7C9]/50"></span>
                        Steps
                      </h2>
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
                    </div>
                  )}
    
                  {/* Visual Aid */}
                  {loadingMermaid && (
                    <div className="flex items-center gap-2 text-[13px] text-[#69688D] italic font-medium animate-pulse">
                      <Sparkles size={14} className="text-[#76A7C9]" />
                      Generating visual structure…
                    </div>
                  )}

                  {mermaidDiagram && (
                    <div className="mt-6 p-4 rounded-2xl border border-[#1D2633]/10 bg-[#FAFAFA] max-w-[100%] overflow-x-auto custom-scrollbar shadow-sm animate-slide-up">
                      <MermaidDiagram diagram={mermaidDiagram} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center px-4">
                  <div className={`w-20 h-20 bg-[#1D2633]/5 rounded-full flex items-center justify-center mb-6 border-2 border-[#1D2633]/10 relative ${loadingAssist ? "" : "animate-float-slow"}`}>
                    {loadingAssist ? (
                      <div className="w-10 h-10 border-[3px] border-[#1D2633]/10 border-t-[#1D2633] rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={32} className="text-[#1D2633] opacity-60" strokeWidth={1.5} />
                    )}
                  </div>
                  <h2 className="text-[24px] sm:text-[28px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] mb-2 tracking-tight">
                    {loadingAssist ? "Distilling insights" : "Ready to listen"}
                  </h2>
                  <p className="text-[#69688D] text-[15px] sm:text-[16px] max-w-[280px]">
                    {loadingAssist ? "Processing the audio conversation based on your preferences." : "Click the button below to start capturing the conversation."}
                  </p>
                </div>
              )}
            </div>

            {/* Context Query / Chat Bar */}
            <div className="mt-auto bg-white border-t border-[#1D2633]/5 p-4 sm:p-5 sm:px-7 sticky bottom-0 z-20">
              <input
                id="context-file-input"
                type="file"
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAttachedFile(file);
                  }
                }}
              />

              {attachedFile && (
                <div className="w-full max-w-[52rem] mx-auto mb-2.5 flex items-center">
                  <div className="flex items-center gap-2 bg-[#F5F7F8] border border-[#1D2633]/10 rounded-lg px-3 py-2 max-w-full">
                    <span className="text-[13px] font-medium text-[#1D2633] truncate max-w-[260px]">
                      {attachedFile.name}
                    </span>

                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-[#69688D] hover:text-[#1D2633] transition-colors"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              
              <div className="w-full max-w-[52rem] mx-auto flex gap-2.5">

                <button
                  type="button"
                  onClick={() => document.getElementById("context-file-input")?.click()}
                  className="flex-shrink-0 w-[48px] h-[48px] rounded-xl bg-[#FAFAFA] border-2 border-[#1D2633]/10 text-[#1D2633] flex items-center justify-center hover:border-[#76A7C9] hover:bg-[#F7F9FA] hover:text-[#568FBD] active:scale-95 transition-all"
                  title="Attach file"
                >
                  <Plus size={21} strokeWidth={2.5} />
                </button>

                <input
                  type="text"
                  value={contextQuery}
                  onChange={(e) => setContextQuery(e.target.value)}
                  placeholder="Ask for clarification, examples, or simpler terms..."
                  className="flex-1 bg-[#FAFAFA] border-2 border-[#1D2633]/10 rounded-xl px-4 py-3 text-[14.5px] text-[#1D2633] placeholder:text-[#69688D]/50 focus:outline-none focus:border-[#76A7C9] focus:ring-4 focus:ring-[#76A7C9]/20 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContextQuery();
                  }}
                />
                <button
                  onClick={handleContextQuery}
                  disabled={loadingContextQuery || !assistResult}
                  className="px-5 sm:px-6 py-3 rounded-xl bg-[#1D2633] text-white font-bold text-[14.5px] shadow-md shadow-[#1D2633]/15 transition-all hover:bg-[#29344a] hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed active:scale-[0.98] flex items-center gap-2"
                >
                  <span className="hidden sm:inline">{loadingContextQuery ? "Thinking..." : "Ask"}</span>
                  <ArrowRight size={18} className="sm:hidden" />
                </button>
              </div>
            </div>
          </main>

          {/* Right Column: Controls Sidebar */}
          <aside className="w-full lg:w-[320px] xl:w-[340px] bg-[#FAFAFA] border-t lg:border-t-0 lg:border-l border-[#1D2633]/5 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
            <div className="p-5 sm:p-7 flex flex-col gap-8 flex-1">
              
              {/* Primary Action Button */}
              <div className="hidden lg:block">
                <button
                  onClick={recording ? stopRecording : startRecording}
                  className={`group flex items-center justify-center gap-2.5 w-full py-[17px] rounded-[1rem] font-bold text-[16px] transition-all duration-300 ${
                    recording
                      ? "bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100 shadow-sm"
                      : "bg-[#1D2633] text-white shadow-lg shadow-[#1D2633]/20 hover:bg-[#29344a] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
                  }`}
                >
                  {recording ? (
                    <>
                      <Square size={18} fill="currentColor" className="animate-pulse" />
                      <span>Stop Listening</span>
                    </>
                  ) : (
                    <>
                      <Mic size={18} />
                      <span>Start Listening</span>
                    </>
                  )}
                </button>
              </div>

              {/* Reading Pace Control */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-[#69688D]">Reading Pace</h3>
                  <span className="text-[11px] font-bold px-2.5 py-1 bg-[#1D2633]/5 text-[#1D2633] rounded-md uppercase tracking-wider">
                    {speed < 33 ? "Slow" : speed < 66 ? "Standard" : "Fast"}
                  </span>
                </div>
                <div className="space-y-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1D2633]/10 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#76A7C9]/40"
                    style={{
                      background: `linear-gradient(to right, #1D2633 0%, #1D2633 ${speed}%, rgba(29,38,51,0.1) ${speed}%, rgba(29,38,51,0.1) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-[11px] text-[#69688D] font-semibold">
                    <span>Slower</span>
                    <span>Faster</span>
                  </div>
                </div>

                <button
                  onClick={() => setPaused(!paused)}
                  className={`w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] transition-all duration-300 border-2 active:scale-[0.98] ${
                    paused 
                      ? "border-[#1D2633] bg-[#1D2633]/5 text-[#1D2633] shadow-sm" 
                      : "border-[#1D2633]/10 bg-white text-[#69688D] hover:border-[#1D2633]/30 hover:bg-[#1D2633]/[0.02] hover:text-[#1D2633]"
                  }`}
                >
                  {paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                  {paused ? "Resume Animation" : "Pause Animation"}
                </button>
              </div>

              {/* Preferences */}
              <div className="space-y-4">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-[#69688D]">Preferences</h3>
                <div className="space-y-2">
                  <label className="group flex items-center justify-between p-3.5 rounded-xl border-2 border-[#1D2633]/10 bg-white hover:border-[#1D2633]/30 hover:bg-[#1D2633]/[0.02] cursor-pointer transition-all">
                    <span className="text-[14px] font-medium text-[#1D2633] transition-colors">Visual aids</span>
                    <div className={`flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all ${
                      allowVisuals ? "bg-[#1D2633] border-[#1D2633]" : "border-[#1D2633]/20"
                    }`}>
                      <Check size={12} className={`text-white stroke-[4] transition-opacity ${allowVisuals ? "opacity-100" : "opacity-0"}`} />
                    </div>
                    <input type="checkbox" checked={allowVisuals} onChange={(e) => setAllowVisuals(e.target.checked)} className="hidden" />
                  </label>

                  <label className="group flex items-center justify-between p-3.5 rounded-xl border-2 border-[#1D2633]/10 bg-white hover:border-[#1D2633]/30 hover:bg-[#1D2633]/[0.02] cursor-pointer transition-all">
                    <span className="text-[14px] font-medium text-[#1D2633] transition-colors">Text-only mode</span>
                    <div className={`flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all ${
                      textOnly ? "bg-[#1D2633] border-[#1D2633]" : "border-[#1D2633]/20"
                    }`}>
                      <Check size={12} className={`text-white stroke-[4] transition-opacity ${textOnly ? "opacity-100" : "opacity-0"}`} />
                    </div>
                    <input type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} className="hidden" />
                  </label>
                </div>
              </div>

            </div>
          </aside>
        </div>
      </div>

      {/* Mobile/Narrow Width Sticky Recording Button */}
      <div className="lg:hidden sticky bottom-0 bg-[#E3E2D9] pt-3 pb-safe z-50">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`group flex items-center justify-center gap-2.5 w-full py-[17px] rounded-[1rem] font-bold text-[16px] transition-all duration-300 shadow-lg ${
            recording
              ? "bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100 shadow-sm"
              : "bg-[#1D2633] text-white shadow-[#1D2633]/20 active:scale-[0.98]"
          }`}
        >
          {recording ? (
            <>
              <Square size={18} fill="currentColor" className="animate-pulse" />
              <span>Stop Listening</span>
            </>
          ) : (
            <>
              <Mic size={18} />
              <span>Start Listening</span>
            </>
          )}
        </button>
      </div>

      {/* Styles mapping exactly to Boarding & HomePage definitions */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #D0D4DB; border-radius: 10px; }
        
        @keyframes slideUpFade {
          0% { opacity: 0; transform: translateY(12px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-up {
          animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes floatSlow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(0, -8px); }
        }
        .animate-float-slow {
          animation: floatSlow 6s ease-in-out infinite;
        }

        /* Ensure input ranges look sharp across browsers */
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