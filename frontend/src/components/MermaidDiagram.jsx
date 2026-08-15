import React, { useEffect, useRef, useId } from "react";
import mermaid from "mermaid";

// Initialize once outside the component
mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#FAFAFA",
    primaryTextColor: "#1D2633",
    primaryBorderColor: "#76A7C9",
    lineColor: "#1D2633",
    secondaryColor: "#E3F2FD",
    tertiaryColor: "#FAFAFA",
    fontSize: "18px",
    fontFamily: "Atkinson Hyperlegible, sans-serif"
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: "basis",
    defaultRenderer: "dagre-wrapper"
  }
});

const MermaidDiagram = ({ diagram }) => {
  const renderContainerRef = useRef(null);
  // Use useId to get a consistent unique ID prefix for this component instance
  const uniqueId = useId().replace(/:/g, ""); 

  useEffect(() => {
    if (!diagram || !renderContainerRef.current) return;

    let cancelled = false;
    renderContainerRef.current.innerHTML = "";

    const id = `mermaid-${uniqueId}-${Date.now()}`;

    mermaid
        .render(id, diagram)
        .then(({ svg }) => {
        if (!cancelled && renderContainerRef.current) {
            renderContainerRef.current.innerHTML = svg;
        }
        })
        .catch((err) => {
        console.error("Mermaid Render Error:", err);
        if (renderContainerRef.current) {
            renderContainerRef.current.innerHTML =
            `<p class="text-[10px] text-gray-400">Unable to render visual.</p>`;
        }
        });

    return () => {
        cancelled = true;
    };
    }, [diagram]);

  return (
    <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl overflow-x-auto">
      <div 
        ref={renderContainerRef} 
        // Changed from justify-center to justify-start to ensure smooth left-to-right scrolling
        className="flex justify-start items-center min-h-[100px] min-w-max"
      />
    </div>
  );
};

export default MermaidDiagram;