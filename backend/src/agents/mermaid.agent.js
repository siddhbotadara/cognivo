import { GoogleGenAI } from "@google/genai";
import { quotaManager } from "../utils/quotaManager.js";
import { DIAGRAM_MODEL } from "../config/geminiTiers.js";

// Force every diagram to flow top-to-bottom, no matter what the model returned.
// - rewrites the header line to "flowchart TD"
// - strips any "direction LR/RL/BT/TB" lines (used inside subgraphs)
export function forceTopDown(diagram) {
  if (!diagram) return diagram;

  const lines = diagram.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*(?:flowchart|graph)\b/i.test(l));
  if (idx === -1) return diagram;

  // Anything left on the header line after the keyword/direction (e.g. "flowchart LR A-->B")
  const rest = lines[idx]
    .match(/^\s*(?:flowchart|graph)\b[:;\s]*(?:(?:LR|RL|TB|BT|TD)\b[;\s]*)?(.*)$/i)[1]
    .trim();

  const body = lines
    .slice(idx + 1)
    .filter((l) => !/^\s*%%\{.*\}%%\s*$/.test(l))   // init directives (rankDir etc.)
    .filter((l) => !/^\s*direction\s+\w+\s*;?\s*$/i.test(l))
    .map((l) => l.replace(/;?\s*direction\s+(?:LR|RL|TB|BT|TD)\s*;?\s*$/i, "")); // inline direction

  return ["flowchart TD", ...(rest ? [rest] : []), ...body].join("\n");
}

export async function generateMermaidDiagram({
  simplified,
  keyPoints,
}) {
  const apiKey = quotaManager.getKey("diagram");
  const ai = new GoogleGenAI({ apiKey });

  // Always vertical. (type is still accepted so the controller doesn't change.)
  const diagramType = "flowchart TD";

  const prompt = `
  You are an accessibility AI generating VISUAL SCAFFOLDING.

  STEP 1 - DECIDE: Would a flowchart meaningfully help understanding?
  - YES if the text describes a process, steps, cause and effect, or a progression.
  - NO if it is only an emotional state, status update, opinion, or isolated facts.
  If NO, output exactly one word and nothing else: NONE

  STEP 2 - If YES, generate a Mermaid.js ${diagramType} diagram.

  RULES:
  1. The FIRST line MUST be exactly: ${diagramType}
    The diagram MUST flow vertically, top to bottom. NEVER use LR, RL or BT. NEVER add "direction" lines or subgraphs.
  2. Max 6 nodes, connected in a single vertical chain or a small top-down tree.
  3. STRICT LIMIT: Each node text MUST be 1 to 6 words maximum.
  4. NO CLIFFHANGERS: Nodes must contain complete, logical phrases. Do NOT end nodes with connecting words (e.g., "by", "the", "and", "to", "might").
  5. CONTINUOUS FLOW: If a thought is too long for 6 words, put the continuation in the next connected node (e.g., Node 1: "Speaker tested microphone" --> Node 2: "To ensure clear audio").
  6. Output ONLY the raw diagram syntax without markdown tags (or the single word NONE).

  Summary: ${simplified}
  Key Points: ${keyPoints.join("\n")}
  `;

  let response;
  try {
    response = await ai.models.generateContent({
      model: DIAGRAM_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
  } catch (err) {
    console.error("❌ Diagram generation failed:", err?.message || err);
    return null;   // Dashboard then shows its fallback diagram
  }

  let output =
    response?.text ??
    response?.response?.text ??
    response?.candidates?.[0]?.content?.parts?.[0]?.text ??
    response?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log("🧠 RAW GEMINI OUTPUT:", output);

  if (!output) {
    console.error("❌ Gemini returned no readable text");
    return null;
  }

  // Strip markdown fences if the model added them anyway
  output = output.replace(/```mermaid/gi, "").replace(/```/g, "").trim();
  if (/^none\b/i.test(output)) return null;   // model decided no visual is needed

  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find the first line that starts a diagram
  const startIndex = lines.findIndex(
    (l) => l.toLowerCase().startsWith("flowchart") || l.toLowerCase().startsWith("graph")
  );

  if (startIndex === -1) {
    console.error("❌ No Mermaid diagram found:", output);
    return null;
  }

  output = lines.slice(startIndex).join("\n");

  // Hard guarantee: top-down, whatever the model did.
  return forceTopDown(output);
}