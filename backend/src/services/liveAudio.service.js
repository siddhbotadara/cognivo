import WebSocket from "ws";

export class GeminiLiveService {
  constructor(onTranscript) { // Remove options/targetLanguageCode
    this.apiKey = process.env.GEMINI_SIDDH_API_1;
    this.onTranscript = onTranscript;
    this.ws = null;
    this.isConnected = false;
    this.shouldReconnect = true;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000; 
    this.connectedAt = null;
  }

  connect() {
    if (!this.shouldReconnect) return;
    if (this.ws) return;

    // We only use the native flash preview model now for pure transcription
    const MODEL = "models/gemini-3.1-flash-live-preview";
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
    
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.isConnected = true;
      this.connectedAt = Date.now();
      console.log("Connected to Gemini Live API");

      // Stripped away translationConfig entirely
      const setupMessage = {
        setup: {
          model: MODEL,
          generationConfig: { responseModalities: ["AUDIO"] },
          inputAudioTranscription: {},
          systemInstruction: {
            parts: [{ text: "You are a silent background listener. Do not speak, respond, converse, narrate, or repeat anything back under any circumstances. Produce no audio output at all. Only output the accurate transcription of the user's audio." }]
          }
        }
      };
      this.ws.send(JSON.stringify(setupMessage));
    });

    this.ws.on("message", (data) => {
      const response = JSON.parse(data.toString());

      if (response.error) console.error("Gemini Live setup/error message:", response.error);
      if (response.setupComplete) console.log("Gemini Live setup complete, session ready.");

      if (response.serverContent) {
        // Read input transcription natively without assuming translated output
        const transcriptText = response.serverContent.inputTranscription?.text;
        if (transcriptText) {
          this.onTranscript(transcriptText);
        }
      }
    });

    this.ws.on("close", (code, reason) => {
      this.isConnected = false;
      this.ws = null;
      console.log(`Gemini connection closed. code=${code} reason=${reason?.toString() || "(none)"}`);

      // If the session lived less than 5s, it's a real failure (bad config,
      // quota, auth) — back off exponentially instead of hammering the API
      // once a second. A session that stayed up a while resets the delay.
      const livedMs = this.connectedAt ? Date.now() - this.connectedAt : 0;
      if (livedMs < 5000) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      } else {
        this.reconnectDelay = 1000;
      }

      if (this.shouldReconnect) {
        console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
      }
    });

    this.ws.on("error", (err) => {
      console.error("Gemini WS Error:", err);
    });
  }

  sendAudioChunk(binaryData) {
    if (!this.isConnected) return;

    const base64Audio = binaryData.toString("base64");

    // realtimeInput.mediaChunks is deprecated (close code 1007: "Use audio,
    // video, or text instead"). Use the singular `audio` field.
    const message = {
      realtimeInput: {
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: base64Audio
        }
      }
    };

    this.ws.send(JSON.stringify(message));
  }

  stop() {
    this.shouldReconnect = false;

    // Cancel any pending reconnect timer so it can't fire after stop().
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}