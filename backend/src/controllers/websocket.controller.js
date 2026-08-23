import { GeminiLiveService } from "../services/liveAudio.service.js";

// Removed 'async' so Fastify doesn't prematurely terminate the connection
export function handleLiveAudioStream(connection, request) {
  // Gracefully handle @fastify/websocket v11+ (connection is the socket) 
  // vs older versions (connection.socket is the socket)
  const ws = connection.socket || connection;

  try {
    const geminiService = new GeminiLiveService((transcript) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "transcript", text: transcript }));
      }
    });

    geminiService.connect();

    ws.on("message", (message, isBinary) => {
      try {
        if (isBinary) {
          geminiService.sendAudioChunk(message);
        } else {
          const data = JSON.parse(message.toString());
          if (data.type === "stop") {
            geminiService.stop();
          }
        }
      } catch (err) {
        request.log.error("Error processing websocket message:", err);
      }
    });

    ws.on("close", () => {
      geminiService.stop();
    });

    ws.on("error", (error) => {
      request.log.error(error); 
      geminiService.stop();
    });

  } catch (error) {
    request.log.error(error);
    // Safe closure handling
    if (ws && typeof ws.close === 'function') {
      ws.close(1011, "Failed to initialize live audio stream");
    }
  }
}