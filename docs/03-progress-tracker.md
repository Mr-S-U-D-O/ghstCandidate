# ghstCandidate — Progress Tracker

> This file is the single source of truth for development phase completion.
> Update checkboxes as phases are completed.

---

## Build Phases

- [x] **Phase 0: Project Scaffolding & Docs** *(Complete)*
  - [x] Git repository initialized
  - [x] `/frontend`, `/backend`, `/docs` directories created
  - [x] Project memory docs written (`01`, `02`, `03`)
  - [x] Vite + React + TypeScript frontend scaffolded
  - [x] Tailwind CSS configured with custom fonts
  - [x] Backend Node.js + TypeScript + Express initialized
  - [x] `tsconfig.json` generated for backend
  - [x] Playwright installed in backend

- [x] **Phase 1a: Landing Page** *(Complete)*
  - [x] `LandingPage.tsx` component built
  - [x] Navigation: sticky, logo + Login/Sign up buttons
  - [x] Hero section: headline, sub, CTA, dashboard mock
  - [x] Social proof band
  - [x] "How It Works" 3-column bento grid
  - [x] Human-in-the-loop split section
  - [x] Final CTA + footer
  - [x] Wired as default route in `App.tsx`

- [x] **Phase 1b: Auth Engine** *(Complete)*
  - [x] Split-screen layout (left: brand panel, right: form panel)
  - [x] Sliding panel animation between Sign In / Sign Up
  - [x] Form validation (email, password strength)
  - [x] JWT or session-based auth (backend endpoint stubs)
  - [x] Protected route setup in React Router

- [x] **Phase 2: Dynamic "Typeform-style" Onboarding** *(Complete)*
  - [x] Multi-step form with smooth vertical scroll / transitions
  - [x] Personal info collection (name, location, target role, seniority)
  - [x] CV / resume upload (PDF) and parsing trigger
  - [ ] Gemini API integration for CV analysis → structured JSON output
  - [x] Job preferences form (industry, salary, remote/hybrid/on-site)
  - [x] Onboarding completion → redirect to Dashboard

- [x] **Phase 3: Dashboard & Job Discovery Kanban** *(Complete)*
  - [x] Sidebar layout with navigation
  - [x] Kanban board: Discovered → Review → Applied
  - [x] Job card component (title, company, match score, status badge)
  - [x] Top action bar with search + "Run AI Scraper"
  - [x] Dummy data seeded across columns

- [ ] **Phase 4: AI Matchmaker & Reporting Popups** *(Current)*
  - [ ] Slide-over MatchReportPanel component
  - [ ] "The Ghost's Verdict" AI reasoning section
  - [ ] Skill matrix (matches found vs. missing/weak)
  - [ ] Execution plan with Playwright action list
  - [ ] Approve & Queue / Reject Job footer actions

- [x] **Phase 4: AI Matchmaker & Reporting Popups** *(Complete)*
  - [x] Slide-over MatchReportPanel component
  - [x] "The Ghost's Verdict" AI reasoning section
  - [x] Skill matrix (matches found vs. missing/weak)
  - [x] Execution plan with Playwright action list
  - [x] Approve & Queue / Reject Job footer actions

- [ ] **Phase 5: Backend Brain — Gemini API Integration** *(Complete)*
  - [x] Install cors, dotenv, @google/generative-ai
  - [x] .env with GEMINI_API_KEY (gitignored)
  - [x] Express server.ts boilerplate with CORS + JSON
  - [x] POST /api/analyze-job endpoint
  - [x] Gemini prompt engineering for match scoring
  - [x] Structured JSON response (score, verdict, matches, gaps, plan)

- [x] **Phase 6: Full-Stack Bridge & Live Scraping** *(Complete)*
  - [x] Backend: Playwright scraping from URL → raw text
  - [x] Backend: Feed scraped text to Gemini instead of raw JD string
  - [x] Frontend: Remove mock data, empty Kanban on load
  - [x] Frontend: Bind input to jobUrlInput state
  - [x] Frontend: POST to /api/analyze-job on button click
  - [x] Frontend: Append live result to Kanban in REVIEW column
  - [x] Frontend: MatchReportPanel reads live AI data (no more hardcoded look-ups)

- [x] **Phase 7: The Application Runner Scaffold** *(Complete)*
  - [x] Strict model override to `gemini-1.5-flash`
  - [x] Integrate `logo-transparent.png`
  - [x] POST `/api/apply-job` endpoint with visible Playwright browser
  - [x] Wire Dashboard "Approve & Queue" to hit `/api/apply-job`
  - [x] Move job to APPLIED column on success

- [x] **Phase 8: DOM Mapping, Blocker Detection & Form Execution** *(Complete)*
  - [x] Blocker Detection (login wall / CAPTCHAs) with 60s pause
  - [x] Extract form fields using page.$$eval
  - [x] Gemini API call to map profile to fields
  - [x] Fill form live using Playwright
  - [x] Update frontend MatchReportPanel button text

- [x] **Phase 9: AI CV Parsing & Global Context** *(Complete)*
  - [x] Global React Context for CandidateProfile
  - [x] POST `/api/parse-cv` endpoint in backend
  - [x] Gemini Base64 multimodal parsing
  - [x] Frontend Base64 upload & API integration
  - [x] Auto-fill onboarding steps 3 & 4 with extracted data

- [x] **Phase 10: Full-Screen Ghost Profiler (Chatbot)** *(Complete)*
  - [x] Update UserContext for dynamic profiles
  - [x] Create `/api/chat-profiler` endpoint
  - [x] Build `GhostChat.tsx` UI with typing animations
  - [x] Add Sidebar tab to toggle between Kanban and Chat

- [x] **Phase 11: Autonomous Execution & Graceful Failure** *(Complete)*
  - [x] Change Playwright to headless: true
  - [x] Update Gemini prompt to flag UNKNOWN_REQUIRED_INPUT
  - [x] Abort logic: 400 NEEDS_INPUT response when field is unknown
  - [x] Frontend: "Needs Input" amber badge on Kanban card
  - [x] Frontend: Ghost Profiler sidebar tab pulse animation

- [x] **Phase 12: Permanent Memory (Supabase Integration)** *(Complete)*
  - [x] Supabase schema: profiles, jobs, chat_history tables
  - [x] Frontend & backend Supabase client initialization
  - [x] Supabase Auth replacing mock redirect
  - [x] Route protection via AuthGuard
  - [x] Profile sync to DB (onboarding + Ghost Profiler)
  - [x] Jobs Kanban persistence to DB
  - [x] Chat history persistence to DB

- [x] **Phase 13: The Hunter (Automated Job Crawler)** *(Complete)*
  - [x] Refactor jobController.ts for reusable Gemini logic
  - [x] Implement `POST /api/hunt-jobs` to scrape LinkedIn and process batch
  - [x] Insert discovered jobs directly to Supabase
  - [x] Update Dashboard UI with Hunter Mode toggle
  - [x] Wire Hunter UI to endpoint and refresh Kanban list

- [x] **Phase 14: The Mobile Polish (Responsive UI/UX)** *(Complete)*
  - [x] Refactor AuthPage & Onboarding flow for iOS zoom & small screens
  - [x] Add mobile top navigation bar & slide-out Sidebar drawer
  - [x] Convert Kanban board into a swipeable snap-scroll container
  - [x] Ensure GhostChat and MatchReportPanel fill screen on mobile

---

## Notes

| Date | Note |
|---|---|
| Project Start | Phase 0 in progress |
