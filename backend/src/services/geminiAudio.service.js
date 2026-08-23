import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_FINAL_KEY,
});

export async function processNativeAudio({ base64Audio, mimeType }) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType, // audio/webm
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT"], // IMPORTANT
    },
  });

  return response.text;
}
