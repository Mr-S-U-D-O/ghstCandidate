# ghstCandidate 👻 (The Ghost Worker)

ghstCandidate is an autonomous, AI-driven job application ecosystem. It automatically discovers hyper-relevant jobs, synthesizes bespoke "Just-In-Time" application materials, and actively pilots a headless browser to apply for you—while you sleep.

## ⚠️ Commercial Use Strictly Prohibited
**This project is strictly locked down for personal, educational, and non-commercial use only.** 
You may not use this repository, its architecture, or any of its internal logic to build a commercial SaaS product or offer paid recruitment services. See the `LICENSE` file for exact legal terms.

## 🚀 Core Features

- **The Ghost Fleet (Distributed Apify Architecture):** 
  Bypasses rate limits and scales job ingestion horizontally by routing highly-structured ATS (Applicant Tracking System) searches across a dynamic fleet of Apify accounts. Controlled entirely via a custom Admin UI.
  
- **Just-In-Time (JIT) Bespoke Documents:**
  Never send a generic resume again. The backend dynamically compiles bespoke, highly-targeted resumes and cover letters in PDF format on-the-fly, perfectly matching your experience to the scraped Job Description.
  
- **Autonomous Stagehand Pilot (AI Browser Agent):**
  Powered by `meta/llama-3.1-70b-instruct` on NVIDIA NIM, our autonomous agent takes control of the browser (via Stagehand) to navigate directly to ATS boards (Greenhouse, Lever, Ashby, etc.), fill out complex application forms, upload your bespoke PDFs, and bypass SSO login walls.

## 🧠 Architecture
- **Frontend:** React, Vite, Tailwind CSS (Meta Astryx Design System)
- **Backend:** Node.js, Express, TypeScript, Server-Sent Events (SSE)
- **Database:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI Brains:** NVIDIA NIM (Llama 3.1 70B), Groq (Llama 3.3 70B), OpenAI SDK integrations.

## 🛠 Setup (Local Development)

1. Clone the repository and install dependencies in both `frontend` and `backend` directories:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```
2. Configure your environment variables `.env`:
   - `SUPABASE_URL` / `SUPABASE_KEY`
   - `NVIDIA_API_KEY` (Required for Stagehand Agent)
   - `GROQ_API_KEY` (Required for JIT Docs / Pre-evaluation)
   - `APIFY_KEY_*` (For the Ghost Fleet)
3. Start both development servers:
   ```bash
   npm run dev
   ```

*Built by a very tired, but very ambitious developer.*
