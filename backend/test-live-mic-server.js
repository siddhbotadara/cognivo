/**
 * test-live-mic-server.js
 *
 * Speak-and-see-it-transcribe test for Gemini Live.
 * One script: serves a browser page that captures your mic, relays the
 * audio to a Gemini Live session on the server (your key never touches
 * the browser), and streams the live transcript back to the page.
 *
 * SETUP:
 *   npm install @google/genai ws dotenv
 *   .env must contain GEMINI_FINAL_KEY=your_key
 *
 * RUN:
 *   node test-live-mic-server.js
 *   open http://localhost:8080
 *   click Start, allow mic access, talk. Click Stop when done.
 *
 * Chrome/Edge only recommended for the quick test (getUserMedia is
 * flakiest on Safari for raw PCM capture). Must be http://localhost —
 * getUserMedia will refuse to run over plain http on any other host.
 */

import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";

if (!process.env.GEMINI_SIDDH_API_1) {
  console.error("❌ GEMINI_FINAL_KEY is not set in your .env file");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_FINAL_KEY });
const MODEL = "gemini-3.1-flash-live-preview"; // fall back to "gemini-live-2.5-flash-preview" if this 404s
const PORT = 8080;

// ─────────────────────────────────────────────────────────────
// Browser page — captures mic, downsamples to 16kHz PCM16, streams
// over a WebSocket, renders the transcript as it arrives.
// ─────────────────────────────────────────────────────────────
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Gemini Live mic test</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; }
  button { font-size: 16px; padding: 10px 20px; margin-right: 10px; cursor: pointer; }
  #status { margin: 16px 0; font-size: 14px; color: #666; }
  #status.live { color: #0a0; font-weight: bold; }
  h3 { margin-bottom: 4px; }
  #transcript { border: 1px solid #ccc; border-radius: 8px; padding: 16px; min-height: 120px; white-space: pre-wrap; line-height: 1.5; }
  #modelReply { border: 1px solid #eee; border-radius: 8px; padding: 12px; min-height: 40px; color: #888; white-space: pre-wrap; margin-top: 20px; font-size: 13px; }
</style>
</head>
<body>
  <h2>Gemini Live — speak and watch it transcribe</h2>
  <button id="startBtn">Start listening</button>
  <button id="stopBtn" disabled>Stop</button>
  <div id="status">not connected</div>

  <h3>What it heard (input transcript)</h3>
  <div id="transcript"></div>

  <h3>What it said back (output transcript, not played as audio)</h3>
  <div id="modelReply"></div>

<script>
let ws, audioContext, processor, source, stream;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const modelReplyEl = document.getElementById('modelReply');

function downsampleBuffer(buffer, inputRate, outputRate) {
  if (outputRate === inputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0, offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) { accum += buffer[i]; count++; }
    result[offsetResult] = count ? accum / count : 0;
    offsetResult++; offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function floatTo16BitPCM(float32Array) {
  const buf = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buf);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function bufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

startBtn.onclick = async () => {
  startBtn.disabled = true;
  statusEl.textContent = 'requesting mic...';

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  source = audioContext.createMediaStreamSource(stream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');

  ws.onopen = () => {
    statusEl.textContent = 'live — listening';
    statusEl.className = 'live';
    stopBtn.disabled = false;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const down = downsampleBuffer(input, audioContext.sampleRate, 16000);
      const pcm = floatTo16BitPCM(down);
      ws.send(JSON.stringify({ type: 'audio', data: bufferToBase64(pcm) }));
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'transcript') {
      if (msg.channel === 'input') transcriptEl.textContent += msg.text;
      if (msg.channel === 'output') modelReplyEl.textContent += msg.text;
    } else if (msg.type === 'status') {
      statusEl.textContent = msg.text;
    } else if (msg.type === 'error') {
      statusEl.textContent = 'error: ' + msg.text;
      statusEl.className = '';
    }
  };

  ws.onclose = () => {
    statusEl.textContent = 'disconnected';
    statusEl.className = '';
  };
};

stopBtn.onclick = () => {
  stopBtn.disabled = true;
  startBtn.disabled = false;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }));
  if (processor) processor.disconnect();
  if (source) source.disconnect();
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (ws) ws.close();
  statusEl.textContent = 'stopped';
  statusEl.className = '';
};
</script>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────
// Server: serves the page, relays audio in / transcripts out over WS
// ─────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(PAGE_HTML);
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", async (clientWs) => {
  console.log("🔌 browser connected");
  let liveSession = null;

  try {
    liveSession = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
        sessionResumption: { handle: null },
        systemInstruction:
          "You are a silent transcription listener for a lecture-capture test. " +
          "Do not hold a conversation, do not ask questions, do not narrate. " +
          "Only respond if directly asked something, and then in under 6 words.",
      },
      callbacks: {
        onopen: () => {
          console.log("✅ Gemini Live session open");
          clientWs.send(JSON.stringify({ type: "status", text: "live — listening" }));
        },
        onmessage: (message) => {
          const sc = message.serverContent;
          if (sc?.inputTranscription?.text) {
            clientWs.send(JSON.stringify({ type: "transcript", channel: "input", text: sc.inputTranscription.text }));
          }
          if (sc?.outputTranscription?.text) {
            clientWs.send(JSON.stringify({ type: "transcript", channel: "output", text: sc.outputTranscription.text }));
          }
        },
        onerror: (err) => {
          console.error("❌ Live session error:", err?.message || err);
          clientWs.send(JSON.stringify({ type: "error", text: err?.message || "live session error" }));
        },
        onclose: (e) => {
          console.log("Live session closed", e?.code, e?.reason);
        },
      },
    });
  } catch (err) {
    console.error("❌ Failed to open Live session:", err);
    clientWs.send(JSON.stringify({ type: "error", text: "failed to connect to Gemini Live: " + err.message }));
    clientWs.close();
    return;
  }

  clientWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "audio" && liveSession) {
      liveSession.sendRealtimeInput({ audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" } });
    } else if (msg.type === "stop" && liveSession) {
      liveSession.sendRealtimeInput({ audioStreamEnd: true });
    }
  });

  clientWs.on("close", () => {
    console.log("🔌 browser disconnected");
    if (liveSession) liveSession.close();
  });
});

server.listen(PORT, () => {
  console.log(`\n▶ Open http://localhost:${PORT} and click Start\n`);
});
