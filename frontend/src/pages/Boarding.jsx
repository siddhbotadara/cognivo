import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const Boarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    comprehensionBreak: "",
    learningPreference: "",
    listeningThought: "",
    struggleNote: "",
    uiPreferences: {
      font: "",
      fontSize: "large"
    }
  });

  // NEW: Live preview! Whenever the font choice changes, apply it to the whole document body instantly.
  useEffect(() => {
    if (form.uiPreferences.font) {
      document.body.style.fontFamily = `"${form.uiPreferences.font}", sans-serif`;
    }
  }, [form.uiPreferences.font]);

  const isStepValid = () => {
    switch (step) {
      case 1:
        return !!form.comprehensionBreak;
      case 2:
        return !!form.learningPreference;
      case 3:
        return true; // optional
      case 4:
        return !!form.uiPreferences.font;
      case 5:
        return !!form.listeningThought;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const isFormValid = () => {
    return (
      form.comprehensionBreak &&
      form.learningPreference &&
      form.uiPreferences.font &&
      form.listeningThought
    );
  };

  const next = () => setStep((s) => s + 1);
  const back = () => {
    if (step === 1) {
      navigate("/");
    } else {
      setStep((s) => s - 1);
    }
  };

  const submit = async () => {
    if (!isFormValid()) {
      alert("Please complete all required steps before continuing.");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/onboarding", form);
      
      // NEW: Save the profile ID and the selected font choice!
      localStorage.setItem("aurasync_profile_id", res.data.profileId);
      localStorage.setItem("user_font", form.uiPreferences.font);
      
      navigate("/app");
    } catch (err) {
      console.error(err);
      alert("Something went wrong while saving. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const OptionCard = ({ label, selected, onClick }) => (
    <button
      onClick={onClick}
      className={`group w-full p-3 sm:p-4 rounded-xl border-2 text-left transition-all duration-300 ease-out flex justify-between items-center active:scale-[0.98]
        ${selected 
          ? "border-[#1D2633] bg-[#1D2633]/5 shadow-md shadow-[#1D2633]/10 -translate-y-0.5" 
          : "border-[#1D2633]/10 bg-white hover:border-[#1D2633]/30 hover:bg-[#1D2633]/[0.02] hover:-translate-y-0.5 hover:shadow-sm"}`}
    >
      <span className={`text-base sm:text-[14.5px] font-medium transition-colors duration-300 ${
        selected
          ? "text-[#1D2633]"
          : "text-[#69688D] group-hover:text-[#1D2633]"
      }`}>
        {label}
      </span>
      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-300
        ${selected ? "bg-[#1D2633] border-[#1D2633] scale-110" : "border-[#1D2633]/20 group-hover:border-[#1D2633]/40"}`}>
        <Check 
          size={12} 
          className={`text-white stroke-[4] transition-all duration-300 ${selected ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} 
        />
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-[#E3E2D9] flex items-center justify-center p-4 sm:p-6 antialiased text-[#1D2633]">

      <div className="relative w-full max-w-lg bg-white rounded-[2rem] overflow-hidden shadow-[0_24px_48px_-16px_rgba(29,38,51,0.14)] border border-[#1D2633]/10 flex flex-col max-h-[90vh] transition-all duration-500 hover:shadow-[0_32px_64px_-16px_rgba(29,38,51,0.18)]">
        
        {/* Progress Strip */}
        <div className="absolute top-0 left-0 right-0 w-full h-1.5 bg-[#1D2633]/5 flex">
          <div
            className="h-full bg-[#1D2633] transition-all duration-700 ease-in-out"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Compact Header */}
          <header className="px-8 pt-10 pb-4 text-center">
            <div className="inline-flex items-center gap-2 mb-2 transition-all duration-300 hover:scale-105">
              <Sparkles size={16} className="text-[#76A7C9] animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#69688D]">Step {step} of 6</span>
            </div>
            <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-[#1D2633] font-[Space_Grotesk,sans-serif]">
              Personalize Cognivo
            </h1>
          </header>

          {/* Body - Optimized for no scroll */}
          <main className="flex-1 overflow-hidden px-8 py-2">
            <div key={step} className="animate-slide-up flex flex-col h-full">
              
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-[13.5px] sm:text-[20px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] leading-snug">
                    Where do you usually lose understanding? <span className="text-[#76A7C9]">*</span>
                  </h2>
                  <div className="grid gap-2">
                    {[
                      ["miss_key_terms", "I miss key terms"],
                      ["lose_connection", "I lose connection between ideas"],
                      ["forget_steps", "I forget earlier steps"],
                      ["overwhelmed_speed", "Things move too fast"],
                      ["cant_retain", "I understand but can’t retain"]
                    ].map(([value, label]) => (
                      <OptionCard
                        key={value}
                        label={label}
                        selected={form.comprehensionBreak === value}
                        onClick={() => setForm({ ...form, comprehensionBreak: value })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-[16px] sm:text-[20px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] leading-snug">
                    What helps you understand best? <span className="text-[#76A7C9]">*</span>
                  </h2>
                  <div className="grid gap-2">
                    {[
                      ["simple_words", "Simpler words"],
                      ["examples", "Practical examples"],
                      ["step_by_step", "Step-by-step breakdown"],
                      ["visuals", "Visual explanations"]
                    ].map(([value, label]) => (
                      <OptionCard
                        key={value}
                        label={label}
                        selected={form.learningPreference === value}
                        onClick={() => setForm({ ...form, learningPreference: value })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-[14px] sm:text-[20px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] leading-snug">
                    One thing you struggle with <span className="text-[#69688D] font-normal">(optional)</span>
                  </h2>
                  <textarea
                    rows="5"
                    className="w-full p-5 text-base border-2 border-[#1D2633]/10 rounded-[1.5rem] focus:ring-4 focus:ring-[#76A7C9]/20 focus:border-[#76A7C9] transition-all duration-300 outline-none resize-none placeholder:text-[#69688D]/50 text-[#1D2633] bg-[#FAFAFA] hover:border-[#1D2633]/20"
                    placeholder="Example: Fast speakers or long paragraphs..."
                    value={form.struggleNote}
                    onChange={(e) => setForm({ ...form, struggleNote: e.target.value })}
                  />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] leading-snug">
                    Choose a reading font <span className="text-[#76A7C9]">*</span>
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {["Atkinson Hyperlegible", "OpenDyslexic", "Lexend", "Arial"].map((font) => (
                      <OptionCard
                        key={font}
                        label={font}
                        selected={form.uiPreferences.font === font}
                        onClick={() => setForm({
                          ...form,
                          uiPreferences: { ...form.uiPreferences, font }
                        })}
                      />
                    ))}
                  </div>
                  <div className="p-5 bg-[#76A7C9]/10 rounded-2xl mt-4 border border-[#76A7C9]/30 transition-all duration-500">
                    <p className="text-[14px] font-bold uppercase tracking-[0.15em] text-[#76A7C9] text-center mb-2">
                      Font Preview
                    </p>

                    <p className="text-[14px] sm:text-[18px] font-medium text-[#1D2633] leading-relaxed text-center transition-all duration-300">
                      {form.uiPreferences.font
                        ? "The quick brown fox jumps over the lazy dog."
                        : "Select a font to see how it looks."}
                    </p>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] leading-snug">
                    Which thought happens more often? <span className="text-[#76A7C9]">*</span>
                  </h2>
                  <div className="grid gap-3">
                    <OptionCard
                      label="“Wait… what did they just say?”"
                      selected={form.listeningThought === "missed_what_was_said"}
                      onClick={() => setForm({ ...form, listeningThought: "missed_what_was_said" })}
                    />
                    <OptionCard
                      label="“I get the words, but not the meaning”"
                      selected={form.listeningThought === "hear_but_not_understand"}
                      onClick={() => setForm({ ...form, listeningThought: "hear_but_not_understand" })}
                    />
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="text-center py-8 animate-in zoom-in-95 duration-700 flex flex-col items-center justify-center h-full">
                  <div className="w-20 h-20 bg-[#1D2633]/5 text-[#1D2633] rounded-full flex items-center justify-center mb-6 animate-bounce-subtle border-2 border-[#1D2633]/10">
                    <Check size={36} className="stroke-[3]" />
                  </div>
                  <h2 className="text-[30px] sm:text-[36px] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] mb-3">
                    You’re all set!
                  </h2>
                  <p className="text-[#69688D] text-base sm:text-[18px] leading-relaxed max-w-[320px] mx-auto">
                    Cognivo is now strictly calibrated to your unique way of thinking.
                  </p>
                </div>
              )}
            </div>
          </main>

          {/* Navigation - Locked to bottom */}
          <footer className="px-8 py-8 mt-auto flex items-center justify-between gap-4 border-t border-[#1D2633]/5 bg-white/50 backdrop-blur-sm z-10">
            <button
              onClick={back}
              className="group flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-bold text-[#69688D]
                transition-all duration-200
                hover:bg-[#1D2633]/5 hover:text-[#1D2633]
                active:scale-95 active:bg-[#1D2633]/10
                focus:outline-none focus:ring-2 focus:ring-[#76A7C9]/30"
            >
              <ChevronLeft
                size={18}
                className="transition-transform duration-200 group-hover:-translate-x-1"
              />
              <span>Back</span>
            </button>

            {step < 6 ? (
              <button
                onClick={next}
                disabled={!isStepValid()}
                className={`group flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg overflow-hidden
                  ${isStepValid() 
                    ? "bg-[#1D2633]/95 text-white hover:bg-[#29344a] shadow-[#1D2633]/20 translate-y-0 active:scale-95 hover:shadow-xl" 
                    : "bg-[#1D2633]/5 text-[#69688D]/50 cursor-not-allowed shadow-none"}`}
              >
                <span>Continue</span>
                <ChevronRight size={18} className={`transition-transform duration-300 ${isStepValid() ? "group-hover:translate-x-1" : ""}`} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={loading || !isFormValid()}
                className={`group flex items-center justify-center gap-3 px-8 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg
                  ${loading || !isFormValid() 
                    ? "bg-[#1D2633]/5 text-[#69688D]/50 cursor-not-allowed shadow-none" 
                    : "bg-[#1D2633]/95 text-white hover:bg-[#29344a] shadow-[#1D2633]/20 translate-y-0 active:scale-95 hover:shadow-xl hover:-translate-y-0.5"}`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Cognivo</span>
                  </>
                )}
              </button>
            )}
          </footer>
        </div>
      </div>
      
      {/* NEW: Removed the font imports from here since they are now properly placed in index.css */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
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
          50% { transform: translate(12px, 18px); }
        }
        .animate-float-slow {
          animation: floatSlow 8s ease-in-out infinite;
        }
        .animate-float-slower {
          animation: floatSlow 12s ease-in-out infinite reverse;
        }

        @keyframes bounceSubtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-subtle {
          animation: bounceSubtle 3s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default Boarding;