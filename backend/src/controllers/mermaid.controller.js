import { generateMermaidDiagram } from "../agents/mermaid.agent.js";

export async function handleMermaid(req, reply) {
  try {
    const { simplified, keyPoints, userPreferences } = req.body;
    const allowVisuals = userPreferences?.allowVisuals !== false;

    if (!simplified || !Array.isArray(keyPoints)) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    if (!allowVisuals) {
      return reply.send({ diagram: null, visualIntent: "USER_DISABLED" });
    }

    const diagram = await generateMermaidDiagram({ simplified, keyPoints });

    return reply.send({ diagram, visualIntent: diagram ? "FLOWCHART" : "NONE" });
  } catch (err) {
    console.error("❌ Mermaid Controller Error:", err);
    return reply.code(500).send({ error: "Visual decision failed" });
  }
}