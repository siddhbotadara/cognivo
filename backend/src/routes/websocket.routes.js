import { handleLiveAudioStream } from "../controllers/websocket.controller.js";

export default async function websocketRoutes(app) {
  app.get("/ws/live-audio", { websocket: true }, handleLiveAudioStream);
}