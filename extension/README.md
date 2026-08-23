# 🧩 Cognivo — Chrome Extension

The Cognivo Chrome extension brings real-time listening assistance directly into your browser — no separate tab, no context switching. Use it while watching a lecture, sitting in a video call, or listening to any spoken content on the web, and get live transcription, simplified explanations, visual diagrams, and narrated read-along audio, right where you already are.

This extension is **not published on the Chrome Web Store** (to avoid the developer registration fee) — you install it locally from source in a few clicks, as described below.

---

## ✨ What it does

The extension is a lightweight client for the Cognivo backend, giving you access to:

- **Live audio capture & transcription** — streams audio to Cognivo's backend and returns a real-time transcript.
- **Adaptive explanations** — simplifies what you just heard, tailored to the comprehension profile you set up during onboarding.
- **Visual diagrams on demand** — auto-generates a simple flowchart or comparison diagram when it would help you follow a process or comparison.
- **Comprehension quizzes** — quick multiple-choice checks to confirm you actually retained what was explained.
- **Read-along narration** — text-to-speech playback with word-by-word highlighting, so you can listen and follow along visually at the same time.
- **Personalized onboarding** — a short setup flow that captures how you struggle with spoken content (missing key terms, losing the thread, forgetting steps, etc.) so explanations are shaped around your actual needs, not a generic summary.

> The exact popup/side-panel UI may evolve — this describes the capabilities the extension is built to surface via the Cognivo backend API.

---

## 📦 Requirements

- **Google Chrome** (or any Chromium-based browser that supports Manifest V3 extensions — Edge, Brave, etc.)
- The **Cognivo backend running and reachable** (locally or a deployed instance) — the extension does not work standalone.

---

## 🚀 Installation (Load Unpacked)

Since this isn't on the Chrome Web Store, you'll load it directly from the repo:

### 1️⃣ Clone the repository

```bash
git clone <this-repo-url>
```

Make sure you're on the latest `main` branch.

### 2️⃣ Start the Cognivo backend

The extension depends on the backend API to do anything useful. Follow the backend setup instructions in the [main project README](../README.md) and get it running locally (or point the extension at a deployed backend URL, if configured to do so) **before** testing the extension.

### 3️⃣ Load the extension into Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the **`extension/`** folder from this repository
5. Cognivo will appear in your extensions list — click the puzzle-piece icon in your toolbar and **pin it** for easy access

### 4️⃣ Use it

1. Click the pinned Cognivo icon on any page
2. Complete onboarding the first time you use it (this personalizes how explanations are delivered)
3. Start a session and let Cognivo transcribe, explain, and narrate along with whatever you're listening to 🎉

---

## 🔄 Updating

Since this is loaded from source rather than the Web Store, updates aren't automatic:

1. `git pull` the latest changes
2. Go to `chrome://extensions`
3. Click the **reload icon** on the Cognivo extension card

---

## 🔐 Permissions & Privacy

As a Manifest V3 extension that captures audio and talks to a backend API, Cognivo requests browser permissions appropriate to that functionality (e.g. active tab access, audio capture, and network access to the backend). Check `manifest.json` in this folder for the exact, current permission set before installing if you want full visibility into what's requested.

Audio and transcript data is sent to the Cognivo backend (and from there to the Gemini API) to generate explanations, diagrams, quizzes, and narration — it is not processed purely on-device. Don't use this on content you don't have the right to transcribe/process.

---

## 🧪 Troubleshooting

**Extension loads but nothing happens when I click it**
- Confirm the Cognivo backend is running and reachable at the URL the extension is configured to use.
- Check `chrome://extensions` for any error badge on the Cognivo card and inspect its service worker logs.

**"Failed to connect" / live transcription doesn't start**
- Confirm your backend's WebSocket endpoint (`/ws/live-audio`) is reachable and not blocked by a firewall or CORS misconfiguration.
- Make sure your Gemini API key is set correctly in the backend `.env`.

**Onboarding won't save**
- Confirm `MONGODB_URL` is configured correctly on the backend — onboarding profiles are stored in MongoDB.

---

## 🛠 Tech Stack

- **Extension:** Chrome Manifest V3
- **Backend:** Fastify + MongoDB + Google Gemini API (see [main README](../README.md) for full details)

---

## 📄 License

See the repository root for license details.
