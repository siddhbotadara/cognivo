# 🧠 Cognivo

**AI-powered Cognivo** is a real-time listening and comprehension assistant designed especially for people with **Auditory Processing Disorder (APD)** and others who struggle to process spoken information in real time.

It captures live audio — from lectures, meetings, videos, or conversations — transcribes it, and transforms it into a form that's easier to follow: **simplified explanations, visual diagrams, narrated audio with word-by-word highlighting, and quick comprehension checks**, tailored to how each person processes information.

Cognivo is available as both a **web app and Chrome extension**, powered by a shared **Fastify + MongoDB + Gemini API** backend.

For people with APD, the challenge isn't necessarily hearing the words — it's **processing and making sense of them**. They may miss key terms, lose the thread of a sentence, struggle to follow multi-step explanations, or hear information without fully absorbing its meaning.

Cognivo addresses this by going beyond transcription. Its onboarding flow identifies **how the user struggles with spoken information** and adapts explanations, pacing, and presentation accordingly. Instead of giving everyone the same generic summary, Cognivo transforms live speech into multiple complementary formats so users can **listen, read, visualize, and check their understanding** in real time.


---

## ✨ What it does

- **Live audio transcription** — streams microphone/tab audio to Gemini's Live API over a WebSocket and transcribes it in real time, with automatic reconnect and backoff if the connection drops.
- **Adaptive AI explanations** — takes a transcript chunk and your onboarding profile (comprehension style, struggle points, learning preference) and returns a simplified explanation, not a generic summary.
- **Follow-up context Q&A** — ask a question about anything already explained and get a grounded answer, with optional web search and file attachment support.
- **Auto-generated visual diagrams** — a lightweight "should this be a diagram?" classifier decides whether a flowchart or comparison graph would help, then generates a clean, constrained Mermaid.js diagram (short nodes, no dangling phrases, max 6 nodes) so it's actually accessible, not just visual clutter.
- **Comprehension quizzes** — auto-generated multiple-choice quizzes based on what was just explained, to check retention in the moment.
- **Text-to-speech playback** — narrates explanations with tone-aware delivery (serious, playful, urgent, etc.), multi-speaker voice support, and **word-level timing sync** for karaoke-style read-along highlighting.
- **Tiered, fair-use AI quota system** — every AI feature (core explanations, diagrams, live audio, quiz) draws from its own daily quota across multiple model tiers (Ultra → Pro → Plus → Lite), automatically falling back to a lighter model instead of hard-failing when a tier is exhausted.
- **Accessibility-first UI** — adjustable font (including Atkinson Hyperlegible / OpenDyslexic), font size, and color mode, driven by a personalized onboarding profile stored per user.
- **Chrome extension** — use Cognivo directly on any webpage without switching tabs. See [`extension/README.md`](./extension/README.md) for setup.

---

## 📦 Prerequisites

- **Node.js** v18.20.8 or v20.20.0
- **npm** (comes with Node.js)
- **Git**
- A **Gemini API key** ([Google AI Studio](https://aistudio.google.com/))
- A **MongoDB URI** (local or shared dev instance — ask a maintainer)

---

## 📁 Project Structure

```text
root
├── backend         # Fastify API — routes, controllers, Gemini agents/services, quota engine
├── frontend        # React + Vite + Tailwind web app
├── extension       # Chrome extension (Manifest V3) — see extension/README.md
├── docs            # Additional documentation
└── README.md
```

**Backend layout (high level):**

```text
backend
├── config/           # geminiTiers.js, ttsConfig.js — model tiers, quotas, TTS voice/language config, MongoDB
├── models/           # UserProfile.js (Mongoose schema — onboarding + UI preferences)
├── agents/           # mermaid.agent.js, visual.agent.js — Gemini prompt logic for diagrams
├── services/         # gemini.service.js, geminiAudio.service.js, liveAudio.service.js, tts.service.js
├── controllers/      # Route handlers (assist, audio, mermaid, onboarding, quota, tts, websocket, health)
├── routes/           # Fastify route registration per feature
├── utils/            # quotaManager.js — shared tiered quota/rate-limit engine
```

---

## 🔁 Running the Project

1. Start the **backend** first.
2. Then start the **frontend**.
3. Frontend talks to the backend at `http://localhost:3000` by default.

---

## 🔧 Backend Setup

### 1️⃣ Navigate to the backend directory

```bash
cd backend
```

### 2️⃣ Install dependencies

```bash
npm install
npm run first
```

### 3️⃣ Configure environment variables

```bash
cp .env.example .env
```

Fill in the required values:

```env
PORT=3000

# Ask the maintainer for these
MONGODB_URL=
GEMINI_FINAL_KEY=
```

> `GEMINI_FINAL_KEY` is the single Gemini API key currently used across all AI features (core explanations, diagrams, live audio, quiz, TTS). Per-feature key overrides are supported in `config/geminiTiers.js` if you need to split usage/billing later.

> 🔐 `.env` files are never committed. Ask a maintainer for shared dev secrets.

### 4️⃣ Start the backend

```bash
npm run dev
```

Expected output:

```
DB Connected
Server listening on port 3000
```

**Backend runs at:** `http://localhost:3000`

---

## 🎨 Frontend Setup

### 1️⃣ Navigate to the frontend directory

```bash
cd ../frontend
```

### 2️⃣ Install dependencies

```bash
npm install
npm run first
```

### 3️⃣ Configure environment variables

```bash
cp .env.example .env
```

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 4️⃣ Start the frontend

```bash
npm run dev
```

**Frontend runs at:** `http://localhost:5173`

---

## 🧩 Chrome Extension

Cognivo also ships as a Chrome extension so you can use it on any page without a separate tab. Setup, permissions, and usage instructions live in [`extension/README.md`](./extension/README.md) — it does **not** require the Chrome Web Store; you load it locally as an unpacked extension.

The extension requires the backend to be running locally (or pointed at a deployed instance) to function.

---

## 🔌 API Overview

| Route | Method | Purpose |
|---|---|---|
| `/assist` | POST | Simplify a transcript chunk based on the user's profile |
| `/assist/context` | POST | Follow-up Q&A on a previous explanation |
| `/assist/quiz` | POST | Generate a comprehension quiz |
| `/audio/process` | POST | Native audio understanding → transcript → explanation, in one call |
| `/mermaid` | POST | Decide if a visual would help, then generate a Mermaid diagram |
| `/tts/synthesize` | POST | Generate narrated audio with word-timing data |
| `/tts/quota/:profileId` | GET | Remaining TTS quota per model tier |
| `/tts/options` | GET | Available TTS models + supported languages |
| `/onboarding` | POST | Create a user profile |
| `/onboarding/:profileId` | GET / PUT | Fetch or update a profile |
| `/quota/:profileId` | GET | Remaining AI quota per feature/tier |
| `/ws/live-audio` | WS | Live microphone/tab audio → streamed transcript |
| `/health` | GET | Service health check |

---

## ✅ Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Fastify (Node.js)
- **Database:** MongoDB + Mongoose
- **Realtime:** WebSockets (client ↔ backend, and backend ↔ Gemini Live API)
- **AI:** Google Gemini — text generation, native audio understanding, live bidirectional audio, and TTS
- **Extension:** Chrome Manifest V3

---

## 🧪 Common Issues

**404 on onboarding API**
- Confirm your backend is running and `VITE_API_BASE_URL` in the frontend `.env` matches it.
- Restart the backend after editing `.env`.

**MongoDB connection issues**
- Confirm `MONGODB_URL` is set correctly.
- Ask a maintainer for the shared dev database URI if you don't have your own.

**Gemini quota errors**
- Each feature (core / diagram / live / quiz) has its own daily quota across four model tiers. If you're hitting limits constantly in dev, check `config/geminiTiers.js` and adjust `dailyLimit` values for local testing.

---

## 🧠 Notes for Collaborators

- **Do NOT commit `.env` files.**
- **Write secrets in `.env`, never in `.env.example`.**
- Always use `.env.example` as a reference for required variables.
- You do **not** need to install React or Fastify globally — all dependencies are managed via npm scripts.

---

## 🎯 Ready to Go

Once the backend and frontend are both running, the app is fully functional at `http://localhost:5173`. If something breaks, double-check your Node version and `.env` values first.