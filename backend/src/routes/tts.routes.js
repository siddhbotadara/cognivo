import { handleSynthesize, handleTtsQuota, handleTtsOptions } from "../controllers/tts.controller.js";

export default async function ttsRoutes(app) {
  app.post("/tts/synthesize", handleSynthesize);
  app.get("/tts/quota/:profileId", handleTtsQuota);
  app.get("/tts/options", handleTtsOptions);
}