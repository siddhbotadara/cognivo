import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Only one definition bubble can be open at a time (matters on touch devices).
const OPEN_EVENT = "cognivo-hardword-open";

/**
 * A single highlighted hard word with its own definition bubble.
 *  - Mouse: bubble shows ONLY while hovering this exact word, hides on leave.
 *  - Touch / pen: tap to show, tap again or tap anywhere else to hide.
 *  - Keyboard: Enter / Space toggles, Escape closes.
 * The bubble is rendered in a portal on <body> with fixed positioning, so it is
 * never clipped by scroll containers and never affected by parent transforms.
 */
export default function HardWord({ word, definition }) {
  const anchorRef = useRef(null);
  const bubbleRef = useRef(null);
  const idRef = useRef(Math.random().toString(36).slice(2));
  const lastPointerType = useRef("mouse");

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const bubble = bubbleRef.current;
    if (!anchor || !bubble) return;

    const r = anchor.getBoundingClientRect();
    const w = bubble.offsetWidth;
    const h = bubble.offsetHeight;
    const margin = 8;
    const gap = 10;

    const center = r.left + r.width / 2;
    const left = Math.max(margin, Math.min(center - w / 2, window.innerWidth - w - margin));

    let top = r.top - h - gap;
    let below = false;
    if (top < margin) {
      top = r.bottom + gap;
      below = true;
    }

    const arrowLeft = Math.max(12, Math.min(center - left, w - 12));
    setPos({ left, top, arrowLeft, below });
  }, []);

  // Measure + position after the bubble mounts (hidden until positioned)
  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place, definition]);

  // Close when something else opens, on scroll/resize, or on outside tap
  useEffect(() => {
    if (!open) return;

    const onOtherOpen = (e) => {
      if (e.detail !== idRef.current) setOpen(false);
    };
    const onPointerDown = (e) => {
      if (!anchorRef.current?.contains(e.target)) setOpen(false);
    };
    const close = () => setOpen(false);

    window.addEventListener(OPEN_EVENT, onOtherOpen);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener(OPEN_EVENT, onOtherOpen);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const show = () => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: idRef.current }));
    setOpen(true);
  };

  if (!definition) return <>{word}</>;

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        role="button"
        aria-describedby={open ? `hw-${idRef.current}` : undefined}
        onPointerEnter={(e) => {
          lastPointerType.current = e.pointerType;
          if (e.pointerType === "mouse") show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setOpen(false);
        }}
        onPointerDown={(e) => {
          lastPointerType.current = e.pointerType;
        }}
        onClick={() => {
          // Mouse is handled by hover; click toggles for touch / pen
          if (lastPointerType.current !== "mouse") {
            open ? setOpen(false) : show();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open ? setOpen(false) : show();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="text-[#568FBD] font-semibold underline decoration-dotted decoration-[#568FBD]/50 cursor-help touch-manipulation transition-colors hover:text-[#76A7C9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#76A7C9]/50 rounded-sm"
      >
        {word}
      </span>

      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            id={`hw-${idRef.current}`}
            role="tooltip"
            style={{
              position: "fixed",
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              visibility: pos ? "visible" : "hidden",
              zIndex: 80,
              maxWidth: 240,
              width: "max-content",
              pointerEvents: "none",
            }}
            className="bg-[#1D2633] text-white text-[12.5px] px-3.5 py-2.5 rounded-xl shadow-[0_12px_24px_-8px_rgba(29,38,51,0.3)] text-center leading-snug normal-case font-normal font-[Atkinson_Hyperlegible,sans-serif]"
          >
            {definition}
            <span
              style={{
                position: "absolute",
                left: pos?.arrowLeft ?? 0,
                [pos?.below ? "top" : "bottom"]: -4,
                width: 8,
                height: 8,
                background: "#1D2633",
                transform: "translateX(-50%) rotate(45deg)",
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}