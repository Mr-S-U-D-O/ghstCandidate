# ghstCandidate — Project Overview

## App Name
**ghstCandidate**

## Core Concept
A fully automated, AI-powered job-application platform designed to act as the user's silent, tireless job-hunting agent. The platform:

1. **Gathers user info** via a dynamic, multi-step onboarding form (Typeform-style UX).
2. **Analyses the user's CV** using the Gemini API to extract structured career data.
3. **Scrapes job boards** (LinkedIn, Indeed, etc.) for relevant listings based on user preferences and AI-scored compatibility.
4. **Batch-applies** to jobs autonomously using a headless Playwright browser.
5. **Human-in-the-loop** — pauses on ambiguous or edge-case form fields and surfaces them to the user via a real-time WebSocket channel so the user can intervene.
6. **Live progress UI** — a visual "Execution Arena" that streams browser screenshots / application states in real-time.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React (Vite + TypeScript) | User interface, real-time dashboard |
| Backend | Node.js + TypeScript + Express | API server, job orchestration |
| Execution Engine | Playwright | Headless browser automation |
| Intelligence | Google Gemini API | CV analysis, job matching, form-filling |
| Realtime | WebSockets (ws / socket.io) | Live progress streaming to UI |
| Styling | Tailwind CSS + Google Fonts | Design system |

## Key User Flows

1. **Sign Up / Sign In** → Animated split-screen auth page.
2. **Onboarding** → Dynamic Typeform-style form collecting career data + CV upload.
3. **Dashboard** → Kanban board showing job pipeline (Discovered → Applied → Pending Review → Closed).
4. **AI Matchmaker** → Report popup showing why a job was or wasn't a strong match.
5. **Execution Arena** → Real-time streaming view of Playwright applying to jobs; human-in-the-loop prompts surface here.

## Repository Structure

```
ghstCandidate/
├── frontend/          # Vite + React + TypeScript app
├── backend/           # Node.js + TypeScript + Express API
└── docs/              # Project memory & context tracking (this folder)
```
