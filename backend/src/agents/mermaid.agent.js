import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_FINAL_KEY
});

export async function generateMermaidDiagram({ simplified, keyPoints, type = "FLOWCHART" }) {

  const diagramType =
  type === "GRAPH"
    ? "graph LR"
    : "flowchart LR";

  const prompt = `
You are an accessibility AI generating VISUAL SCAFFOLDING.
Task: Generate a Mermaid.js ${diagramType} diagram.

RULES:
1. Max 6 nodes arranged horizontally left-to-right (LR).
2. STRICT LIMIT: Each node text MUST be 1 to 6 words maximum.
3. NO CLIFFHANGERS: Nodes must contain complete, logical phrases. Do NOT end nodes with connecting words (e.g., "by", "the", "and", "to", "might").
4. CONTINUOUS FLOW: If a thought is too long for 6 words, put the continuation in the next connected node (e.g., Node 1: "Speaker tested microphone" --> Node 2: "To ensure clear audio").
5. Output ONLY the raw diagram syntax without markdown tags.

Summary: ${simplified}
Key Points: ${keyPoints.join("\n")}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

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

  output = output.trim();

  // 🛠️ FIX: Allow both flowchart and graph, or return null if it's junk
  // Normalize Mermaid output
  const lines = output.split("\n").map(l => l.trim()).filter(Boolean);

  // Find the first line that starts a diagram
  const startIndex = lines.findIndex(
    l => l.toLowerCase().startsWith("flowchart") || l.toLowerCase().startsWith("graph")
  );

  if (startIndex === -1) {
    console.error("❌ No Mermaid diagram found:", output);
    return null;
  }

  output = lines.slice(startIndex).join("\n");


  return output;
}