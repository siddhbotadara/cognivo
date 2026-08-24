import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowDown, Check, Play, X, Chrome, ExternalLink } from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  // Small helper so each staggered element just needs a delay in ms.
  const reveal = (animation, delayMs, extra = {}) => ({
    animation: `${animation} both`,
    animationDelay: `${delayMs}ms`,
    ...extra,
  });

  return (
    <div className="fixed inset-0 bg-[#E3E2D9] flex items-center justify-center p-4 sm:p-6 md:p-8 text-[#1D2633] font-[Atkinson_Hyperlegible,sans-serif]">
      <div className="cognivo-scroll w-full max-w-6xl md:min-h-[34rem] lg:min-h-[37rem] max-h-[95vh] overflow-y-auto rounded-[1.75rem] sm:rounded-[2rem] lg:rounded-[2.25rem] bg-white border border-[#1D2633]/10 shadow-[0_24px_48px_-16px_rgba(29,38,51,0.14)] flex flex-col md:flex-row">

        {/* Left: brand + signature demo — hidden below md so narrow / extension widths get the full-focus single column */}
        <div className="hidden md:flex md:w-[46%] lg:w-[49%] bg-[#1D2633]/95 p-9 lg:p-10 flex-col">
          <div
            className="inline-flex items-center gap-3"
            style={reveal("cognivoFadeUp 0.6s ease-out", 0)}
          >
            <img
              src="/rounded.png"
              alt="Cognivo"
              className="h-9 w-9 lg:h-11 lg:w-11 rounded-full object-contain"
            />

            <span className="text-[20px] lg:text-[26px] xl:text-[28px] font-extrabold tracking-[0.18em] text-white uppercase">
              Cognivo
            </span>
          </div>

          {/* Signature element: dramatizes the actual job the product does — builds line by line */}
          <div className="mt-8 lg:mt-10 flex-1 flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-7 lg:p-8">

            {/* You hear */}
            <div className="flex items-end pb-8 lg:pb-14">
              <div className="w-full max-w-[30rem] mx-auto text-left">
                <p
                  className="text-[11px] lg:text-[13px] xl:text-[14px] font-bold uppercase tracking-widest text-[#76A7C9]/80"
                  style={reveal("cognivoFadeUp 0.5s ease-out", 150)}
                >
                  You hear
                </p>

                <div className="mt-4 lg:mt-5 flex flex-wrap justify-center gap-2">
                  <span
                    className="px-3 py-2 rounded-md bg-white/10 text-[#E3E2D9] text-[14px] lg:text-[15px] xl:text-[16px]"
                    style={reveal("cognivoFadeUp 0.5s ease-out", 220)}
                  >
                    The
                  </span>

                  <span
                    className="px-3 py-2 rounded-md bg-white/5 text-[#E3E2D9]/25 text-[14px] lg:text-[15px] xl:text-[16px]"
                    style={reveal("cognivoFadeUp 0.5s ease-out", 270)}
                  >
                    meet—
                  </span>

                  <span
                    className="px-3 py-2 rounded-md bg-white/5 text-[#E3E2D9]/20 text-[14px] lg:text-[15px] xl:text-[16px]"
                    style={reveal("cognivoFadeUp 0.5s ease-out", 310)}
                  >
                    ···
                  </span>

                  <span
                    className="px-3 py-2 rounded-md bg-white/10 text-[#E3E2D9] text-[14px] lg:text-[15px] xl:text-[16px]"
                    style={reveal("cognivoFadeUp 0.5s ease-out", 360)}
                  >
                    moved
                  </span>

                  <span
                    className="px-3 py-2 rounded-md bg-white/5 text-[#E3E2D9]/20 text-[14px] lg:text-[15px] xl:text-[16px]"
                    style={reveal("cognivoFadeUp 0.5s ease-out", 400)}
                  >
                    ···
                  </span>

                  <span
                    className="px-3 py-2 rounded-md bg-white/10 text-[#E3E2D9] text-[14px] lg:text-[15px] xl:text-[16px]"
                    style={reveal("cognivoFadeUp 0.5s ease-out", 450)}
                  >
                    Friday
                  </span>
                </div>
              </div>
            </div>

            {/* Cognivo divider */}
            <div
              className="flex w-full items-center gap-3"
              style={reveal("cognivoFadeUp 0.5s ease-out", 600)}
            >
              <div className="h-px flex-1 bg-white/10" />

              <div
                className="flex shrink-0 items-center gap-1.5 text-[#76A7C9]"
                style={reveal("cognivoPulse 2.4s ease-in-out infinite", 1300)}
              >
                <ArrowDown size={14} strokeWidth={2.5} />
                <span className="text-[11px] lg:text-[12px] font-bold uppercase tracking-widest">
                  Cognivo
                </span>
              </div>

              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* You read */}
            <div className="flex items-start pt-8 lg:pt-16">
              <div className="w-full max-w-[30rem] mx-auto text-left">
                <p
                  className="text-[11px] lg:text-[13px] xl:text-[14px] font-bold uppercase tracking-widest text-[#76A7C9]/80"
                  style={reveal("cognivoFadeUp 0.5s ease-out", 720)}
                >
                  You read
                </p>

                <div
                  className="mt-4 lg:mt-5 mx-auto flex w-full max-w-[30rem] items-center gap-2.5 rounded-xl bg-[#E3E2D9] px-4 py-3.5 lg:py-4"
                  style={reveal("cognivoPop 0.5s ease-out", 830)}
                >
                  <span className="flex h-5 w-5 lg:h-6 lg:w-6 shrink-0 items-center justify-center rounded-full bg-[#568FBD] text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>

                  <span className="whitespace-nowrap text-left text-[15px] lg:text-[17px] xl:text-[18px] font-semibold text-[#1D2633] leading-snug">
                    The meeting moved to Friday.
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right: content */}
        <div className="flex-1 p-8 sm:p-12 lg:p-14 xl:p-16 2xl:p-20 flex flex-col justify-center">

          {/* Mobile / Chrome extension demo */}
          <div
            className="cognivo-mobile-demo md:hidden mb-8 rounded-2xl bg-[#1D2633]/95 p-5 sm:p-6"
            style={reveal("cognivoFadeUp 0.6s ease-out", 100)}
          >
            <div className="cognivo-demo-header flex items-center gap-2.5 mb-5">
              <img
                src="/rounded.png"
                alt="Cognivo"
                className="h-7 w-7 rounded-full object-contain"
              />

              <span className="text-[17px] font-extrabold tracking-[0.16em] text-white uppercase">
                Cognivo
              </span>
            </div>

            {/* You hear */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#76A7C9]/80">
                You hear
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="px-2 py-1.5 rounded-md bg-white/10 text-[#E3E2D9] text-[10.5px]">
                  The
                </span>
                <span className="px-2 py-1.5 rounded-md bg-white/5 text-[#E3E2D9]/25 text-[10.5px]">
                  meet—
                </span>
                <span className="px-2 py-1.5 rounded-md bg-white/10 text-[#E3E2D9] text-[10.5px]">
                  moved
                </span>
                <span className="px-2 py-1.5 rounded-md bg-white/5 text-[#E3E2D9]/20 text-[10.5px]">
                  ···
                </span>
                <span className="px-2 py-1.5 rounded-md bg-white/10 text-[#E3E2D9] text-[10.5px]">
                  Friday
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="cognivo-divider my-5 flex items-center gap-2">
              <div className="h-px flex-1 bg-white/10" />
              <div className="flex items-center gap-1 text-[#76A7C9]">
                <ArrowDown size={12} strokeWidth={2.5} />
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  Cognivo
                </span>
              </div>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* You read */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#76A7C9]/80">
                You read
              </p>
              <div className=" cognivo-read-card mt-3 flex items-center gap-2 rounded-xl bg-[#E3E2D9] px-3 py-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#568FBD] text-white">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className="cognivo-read-text text-[12px] sm:text-[13px] font-semibold text-[#1D2633] leading-snug whitespace-nowrap">
                  The meeting moved to Friday.
                </span>
              </div>
            </div>
          </div>

          <div className="relative pl-5 lg:pl-6">
            <div
              className="absolute -left-2 lg:-left-2 top-2 bottom-2 w-1 lg:w-1.5 rounded-full bg-gradient-to-b from-[#568FBD] to-[#76A7C9]"
              style={reveal("cognivoGrow 0.7s ease-out", 100, { transformOrigin: "top" })}
            />

            <h1
              className="text-[34px] sm:text-[40px] lg:text-[52px] xl:text-[58px] 2xl:text-[62px] leading-[1.08] font-semibold text-[#1D2633] font-[Space_Grotesk,sans-serif] tracking-tight"
              style={reveal("cognivoFadeUp 0.65s ease-out", 150)}
            >
              Understand every{" "}
              <span className="relative inline-block whitespace-nowrap">
                <span className="relative z-10">word</span>
                <span
                  className="absolute inset-x-0 bottom-0.5 lg:bottom-1 h-3.5 lg:h-5 xl:h-6 rounded-sm bg-[#76A7C9]/25"
                  style={reveal("cognivoSweep 0.4s ease-out", 700, { transformOrigin: "left" })}
                />
              </span>
              .
            </h1>

            <p
              className="mt-5 sm:mt-6 lg:mt-7 text-[17px] lg:text-[19px] xl:text-[22px] text-[#69688D] leading-[1.6] max-w-[34rem]"
              style={reveal("cognivoFadeUp 0.6s ease-out", 350)}
            >
              Cognivo clarifies speech for people with Auditory Processing Disorder.
            </p>

            {/* Action Buttons */}
            <div
              className="cognivo-action-buttons mt-6 sm:mt-14 lg:mt-16 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4"
              style={reveal("cognivoFadeUp 0.6s ease-out", 500)}
            >
              <button
                onClick={() => navigate("/onboarding")}
                className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#1D2633]/95 px-8 py-[17px] text-[16px] lg:text-[17px] font-bold text-white shadow-[0_1px_2px_rgba(29,38,51,0.06)] transition-all hover:bg-[#29344a] hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-10px_rgba(29,38,51,0.4)] active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#568FBD]"
              >
                Personalize
                <ArrowRight size={18} className="text-[#76A7C9] transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => setIsVideoOpen(true)}
                className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-transparent border-2 border-[#1D2633]/15 px-8 py-[15px] text-[16px] lg:text-[17px] font-bold text-[#1D2633] transition-all hover:bg-[#1D2633]/5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#568FBD]"
              >
                <Play size={18} fill="currentColor" className="text-[#568FBD] transition-transform group-hover:scale-110" />
                Watch Demo
              </button>
            </div>

            {/* GitHub Extension Link */}
            <div
              className="hidden md:flex absolute top-full left-0 right-0 mt-6 lg:mt-8 justify-center"
              style={reveal("cognivoFadeUp 0.6s ease-out", 600)}
            >
              <a
                href="https://github.com/siddhbotadara/cognivo/tree/main/extension"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3.5 rounded-2xl bg-white border border-[#1D2633]/10 px-5 py-3 shadow-[0_4px_12px_-4px_rgba(29,38,51,0.06)] transition-all hover:border-[#1D2633]/20 hover:shadow-[0_8px_16px_-6px_rgba(29,38,51,0.1)] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#568FBD]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E3E2D9]/80 text-[#1D2633] transition-colors group-hover:bg-[#E3E2D9]">
                  <Chrome size={18} />
                </div>

                <div className="flex flex-col text-left">
                  <span className="text-[14px] font-bold text-[#1D2633] leading-tight">
                    Browser Extension
                  </span>

                  <span className="text-[12px] font-medium text-[#69688D] leading-tight mt-0.5">
                    Download from GitHub
                  </span>
                </div>

                <ExternalLink
                  size={16}
                  className="ml-2 text-[#568FBD] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* Video Modal Overlay */}
      {isVideoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1D2633]/80 backdrop-blur-sm p-4 sm:p-6 transition-opacity">
          <div 
            className="relative w-full max-w-5xl bg-black rounded-2xl sm:rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden aspect-video animate-in fade-in zoom-in-95 duration-300"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 bg-black/50 hover:bg-black text-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#568FBD]"
            >
              <X size={24} />
            </button>
            
            {/* YouTube Embed */}
            <iframe
              className="w-full h-full"
              // REPLACE 'YOUR_YOUTUBE_VIDEO_ID' WITH YOUR ACTUAL VIDEO ID 
              src="https://www.youtube.com/embed/YOUR_YOUTUBE_VIDEO_ID?autoplay=1"
              title="Cognivo Product Demo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Space+Grotesk:wght@500;600&display=swap');

        html,
        body,
        #root {
          height: 100%;
        }

        .cognivo-scroll {
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .cognivo-scroll::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 350px), (max-width: 400px) and (max-height: 620px) {

          .cognivo-mobile-demo {
            padding: 0.9rem;
            margin-bottom: 1rem;
          }

          .cognivo-mobile-demo .cognivo-demo-header {
            margin-bottom: 0.7rem;
          }

          .cognivo-mobile-demo .cognivo-divider {
            margin-top: 0.7rem;
            margin-bottom: 0.7rem;
          }

          /* Make the read sentence fit on one line */
          .cognivo-mobile-demo .cognivo-read-card {
            padding-left: 0.55rem;
            padding-right: 0.55rem;
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
            gap: 0.4rem;
          }

          .cognivo-mobile-demo .cognivo-read-text {
            font-size: 7px !important;
            letter-spacing: -0.01em;
          }

          /* Reduce the vertical gap before the buttons */
          .cognivo-action-buttons {
            margin-top: 1.5rem !important;
          }
        }

        @keyframes cognivoFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cognivoPop {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cognivoGrow {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes cognivoSweep {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes cognivoPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}} />

      
    </div>
  );
};

export default HomePage;