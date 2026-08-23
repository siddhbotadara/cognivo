import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  ChevronDown,
  Gauge,
  Sparkles,
  Check,
  LoaderCircle,
} from "lucide-react";

const SPEED_OPTIONS = [0.5, 0.6, 0.75, 0.85, 1, 1.15, 1.25, 1.5];

const TTS_DISPLAY_NAMES = {
  "gemini-3-flash-tts": {
    label: "Cognivo Voice +",
    description: "Natural & fast",
  },
  "gemini-2.5-flash-tts": {
    label: "Cognivo Voice",
    description: "Reliable alternative",
  },
};

export default function TranscriptPlayer({ segments, moduleText, profileId, buildApiUrl, onSyncWords, onSyncActiveIdx, onLoadingChange, }) {
  const audioRef = useRef(null);
  const [options, setOptions] = useState({ models: [] });
  const [ttsModel, setTtsModel] = useState("gemini-3-flash-tts");
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  const [speedOpen, setSpeedOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const [error, setError] = useState(null);
  const [words, setWords] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [quotaLeft, setQuotaLeft] = useState({});

  useEffect(() => {
        onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    fetch(buildApiUrl("/tts/options")).then((r) => r.json()).then(setOptions).catch(() => {});
  }, [buildApiUrl]);

  useEffect(() => {
    if (!profileId) return;
    fetch(buildApiUrl(`/tts/quota/${profileId}`))
      .then((r) => r.json())
      .then((d) => {
        const map = {};
        (d.tiers || []).forEach((t) => (map[t.id] = t.remaining));
        setQuotaLeft(map);
      })
      .catch(() => {});
  }, [buildApiUrl, profileId, ttsModel]);

  // Reset playback state whenever a different module/session is selected
  useEffect(() => {
    setWords([]);
    setIsPlaying(false);
    setError(null);
    if (onSyncWords) onSyncWords([]);
    if (onSyncActiveIdx) onSyncActiveIdx(-1);
    if (audioRef.current) audioRef.current.removeAttribute("src");
  }, [segments, moduleText]);

  const play = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/tts/synthesize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profileId,
          segments,
          moduleText: segments ? undefined : moduleText,
          ttsModel,
          languageCode: "auto", // Hardcoded to auto so TTS uses the native transcription language
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const rawError = data.error || "";

        if (
          rawError.toLowerCase().includes("daily limit") ||
          rawError.toLowerCase().includes("gemini-3-flash-tts")
        ) {
          throw new Error(
            "Daily limit reached. Try another model or come back tomorrow."
          );
        }

        throw new Error(rawError || "Failed to generate audio");
      }

      setWords(data.words || []);
      if (onSyncWords) onSyncWords(data.words || []);

      if (data.modelInfo) {
        setQuotaLeft((prev) => ({
          ...prev,
          [data.modelInfo.tier]: data.modelInfo.remaining,
        }));
      }
      
      const audio = audioRef.current;
      audio.src = `data:${data.mimeType};base64,${data.audioBase64}`;
      audio.playbackRate = speed;
      audio.preservesPitch = true;
      await audio.play();
      setIsPlaying(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl, profileId, segments, moduleText, ttsModel, speed, onSyncWords]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio?.src) return play();
    if (audio.paused) { audio.play(); setIsPlaying(true); }
    else { audio.pause(); setIsPlaying(false); }
  };

  const changeSpeed = (val) => {
    setSpeed(val);
    if (audioRef.current) audioRef.current.playbackRate = val;
  };

  useEffect(() => {
    let raf;
    const tick = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && words.length) {
        const t = audio.currentTime;
        const activeIdx = words.findIndex((w) => t >= w.start && t < w.end);
        if (onSyncActiveIdx) onSyncActiveIdx(activeIdx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [words, onSyncActiveIdx]);

  const hasText = Boolean((segments && segments.length) || moduleText);

  return (
    <div className="rounded-xl border-2 border-[#1D2633]/10 bg-white p-3.5">
      <audio
        ref={audioRef}
        onEnded={() => { setIsPlaying(false); if(onSyncActiveIdx) onSyncActiveIdx(-1); }}
        onPause={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
            <button
            onClick={togglePlay}
            disabled={loading || !hasText}
            className="w-9 h-9 rounded-full bg-[#1D2633] text-white flex items-center justify-center disabled:cursor-wait shrink-0 transition-all"
            >
            {loading ? (
                <LoaderCircle
                size={15}
                className="animate-spin"
                />
            ) : isPlaying ? (
                <Pause size={14} fill="currentColor" />
            ) : (
                <Play size={14} fill="currentColor" className="ml-0.5" />
            )}
            </button>

          <select value={speed} onChange={(e) => changeSpeed(Number(e.target.value))}
            className="text-[12px] font-bold text-[#1D2633] bg-[#FAFAFA] border-2 border-[#1D2633]/10 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#76A7C9] transition-all">
            {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </div>

        <div className="relative">
        <button
          type="button"
          onClick={() => {
            setModelOpen((prev) => !prev);
            setSpeedOpen(false);
          }}
          className="flex items-center gap-2 bg-white border border-[#1D2633]/10 rounded-lg px-2 py-1.5 shadow-xs hover:border-[#76A7C9]/60 transition-all text-left min-w-[150px] justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">

            <span className="text-[12px] font-bold text-[#1D2633] truncate">
              {TTS_DISPLAY_NAMES[ttsModel]?.label || "Cognivo Voice"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {quotaLeft[ttsModel] !== undefined && (
              <span className="text-[10.5px] font-bold text-[#69688D] bg-[#FAFAFA] px-1.5 py-0.5 rounded-md">
                {quotaLeft[ttsModel]} left
              </span>
            )}

            <ChevronDown
              size={12}
              className={`text-[#69688D] transition-transform duration-200 ${
                modelOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {modelOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 w-[180px] bg-white border border-[#1D2633]/10 rounded-xl shadow-xl z-[100] p-1.5 space-y-0.5 animate-slide-up">
                {[...(options.models || [])]
                .sort((a, b) => {
                    if (a.id === "gemini-3-flash-tts") return -1;
                    if (b.id === "gemini-3-flash-tts") return 1;
                    return 0;
                })
                .map((m) => {
                const isSelected = ttsModel === m.id;

                return (
                <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                    setTtsModel(m.id);
                    setModelOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all ${
                    isSelected
                        ? "bg-[#1D2633] text-white"
                        : "text-[#1D2633] hover:bg-[#FAFAFA]"
                    }`}
                >
                    <div className="min-w-0">
                    <div className="text-[12px] font-bold truncate">
                    {TTS_DISPLAY_NAMES[m.id]?.label || m.label}
                    </div>

                    <div
                        className={`text-[10.5px] ${
                        isSelected ? "text-white/70" : "text-[#69688D]"
                        }`}
                    >
                        {m.description ||
                        (m.id === "gemini-3-flash-tts"
                            ? "Natural & fast"
                            : "Reliable alternative")}
                    </div>

                    </div>

                    {isSelected && (
                    <Check size={14} className="text-white shrink-0 ml-2" />
                    )}
                </button>
                );
            })}
            </div>
        )}
        </div>
      </div>

      {error && <p className="text-[11.5px] text-red-600 mt-2">{error}</p>}
      {!hasText && !error && (
        <p className="text-[11.5px] text-[#69688D] mt-2">Select a session with a transcript to replay.</p>
      )}
    </div>
  );
}

export function ModulePlayIcon({ onClick, disabled }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      title="Replay this minute"
      className="p-1 rounded-md text-[#69688D] hover:text-[#568FBD] hover:bg-[#568FBD]/10 disabled:opacity-30 transition-colors"
    >
      <Volume2 size={14} />
    </button>
  );
}