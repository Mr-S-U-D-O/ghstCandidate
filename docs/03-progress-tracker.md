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

- [x] **Phase 15: The Autonomous Execution Engine** *(Complete)*
  - [x] Fix memory leak in `MatchReportPanel.tsx` (inject `candidateProfile`)
  - [x] Expand DOM Extraction to include radio/checkbox inputs
  - [x] Bespoke PDF Document Generation via Gemini and Playwright
  - [x] Implement `cron.ts` for 24/7 background loop with auto-apply

- [x] **Phase 15.1: The ATS Sniper (Search Engine Dorking)** *(Complete)*
  - [x] Deprecate LinkedIn scraping in Hunter
  - [x] DuckDuckGo Dorking logic for Greenhouse, Lever, Workable, Ashby
  - [x] Extract and filter organic search results
  - [x] Direct ATS scraping for analysis

- [x] **Phase 15.2: ATS Sniper Dorking Fix (Parallel Execution)** *(Complete)*
  - [x] Refactor `huntJobs` query to avoid strict quotes and `OR` logic
  - [x] Run DuckDuckGo searches in parallel (`Promise.allSettled`) for all ATS domains
  - [x] Aggregate organic results, deduplicate, filter, and proceed to ATS scraping

- [x] **Phase 15.3: ATS Sniper Evasion Patch** *(Complete)*
  - [x] Switch to Bing Search engine
  - [x] Apply stealth headers (`User-Agent`)
  - [x] Revert to sequential execution with manual anti-spam delays
  - [x] Update DOM extraction for Bing's HTML structure

- [x] **Phase 15.4: Real-Time Execution Visibility & Debugging** *(Complete)*
  - [x] Implement `.env` `HEADLESS=false` toggle with `slowMo`
  - [x] Add granular logging to sequential Bing loops
  - [x] Add cycling progress indicator in frontend Dashboard

- [x] **Phase 16.0: The Purge & API Data Lake Foundation** *(Complete)*
  - [x] Clean House (Remove search engine web scraping from `huntJobs`)
  - [x] The Data Lake Database Schema (Create `global_jobs` table in Supabase)
  - [x] The Unified API Adapter Model (Define `NormalizedJob` and adapter stubs)
  - [x] Environment Configuration (Add new API keys to `.env.example`)

- [x] **Phase 16.1: The JSearch Adapter & Data Lake Insertion** *(Complete)*
  - [x] Implement the JSearch Adapter
  - [x] Connect the "Cold Start" to `huntJobs`

- [x] **Phase 16.2: Expanding the Data Lake (Reed & TheirStack Adapters)** *(Complete)*
  - [x] Implement the Reed.co.uk Adapter
  - [x] Implement the TheirStack Adapter
  - [x] The Pacing Engine (Smart Fallback)

- [x] **Phase 16.4: Adding Indeed Scraper API to the Data Lake** *(Complete)*
  - [x] Implement the Indeed Adapter
  - [x] Update the Fallback Engine
  - [x] Environment Configuration

- [x] **Phase 17.0: The Gemini Evaluation Engine** *(Complete)*
  - [x] Fetching Un-Evaluated Jobs
  - [x] Gemini Scoring Loop
  - [x] Kanban Board Insertion

- [x] **Phase 17.1: Smart Data Lake Routing & Fuzzy Search Fix** *(Complete)*
  - [x] Build the Exclusion List
  - [x] Check the Data Lake (Fuzzy Search)
  - [x] Trigger External APIs (If < 5 jobs found)
  - [x] Gemini Evaluation

- [x] **Phase 17.2: Fix Kanban Payload Schema** *(Complete)*
  - [x] Remove 'description' from Kanban insert payload

- [x] **Phase 18.0: Auth Guard Fix & Candidate Identity / AI Memory Hub** *(Complete)*
  - [x] Auth Guard & Direct Navigation Fix
  - [x] Database Schema: Candidate Memory & Documents
  - [x] Candidate Identity & AI Memory View (`ProfileHub.tsx`)
  - [x] Navigation Link

- [/] **Phase 19.0: Comprehensive System Audit & Flow Architecture** *(Complete)*
  - [x] Full source audit across all routes, controllers, and context
  - [x] `docs/04-system-audit-and-flow.md` generated

- [x] **Phase 19.1: Document Hub UI, Cover Letter Onboarding & Core Patches** *(Complete)*
  - [x] Core: Replace hardcoded `localhost:3001` with `VITE_API_BASE_URL` across all frontend components
  - [x] Core: Fix sidebar user display — wire to `candidateProfile.name`
  - [x] Core: Add Cover Letters to sidebar navigation
  - [x] Core: Inject `candidate_memories` into Gemini scoring prompts (`analyzeJobText`)
  - [x] Core: Inject `candidate_memories` into document generation prompt (`applyJob`)
  - [x] Database: Add `raw_cover_letter_text` to `profiles` table
  - [x] Database: Add `changes_made` and `reasoning` to `generated_docs` table
  - [x] Onboarding: Add Step 3 — Cover Letter upload (6 steps total, shifted roles/location)
  - [x] `UserContext`: Add `rawCoverLetterText` field and sync to Supabase
  - [x] Create `ResumesPage.tsx` with Original CV accordion and Tailored Resumes vault
  - [x] Create `CoverLettersPage.tsx` with Original CL accordion and Tailored CL vault
  - [x] Dashboard: Route `resumes` and `cover_letters` nav items to new pages
  - [x] Gemini docgen: Return `changes_made` + `reasoning` alongside HTML
  - [x] `applyJob`: Write `generated_docs` rows with metadata on generation
  - [x] Pass `userId` and `jobMeta` from `MatchReportPanel` to apply-job API

- [x] **Phase 19.2: Cloud Storage Integration (The Document Vault)** *(Complete)*
  - [x] Backend: Upload PDFs directly to Supabase Storage (`documents` bucket) instead of local filesystem
  - [x] Backend: Save the public Supabase URL to `file_path` in `generated_docs`
  - [x] Backend: Pass the raw `Buffer` directly to Playwright's `setInputFiles` for form filling
  - [x] Frontend: Update `ResumesPage.tsx` and `CoverLettersPage.tsx` download buttons to directly open the public `file_path` URL

- [x] **Phase 20.0: Global Verbose Logging, Storage Pipeline Seal, & Engine Decoupling** *(Complete)*
  - [x] System-Wide Verbose Logging (Mandatory Across All Controllers)
  - [x] Decouple Document Generation from Auto-Apply Form Filling (`applyJob` refactor)
  - [x] Robust Supabase Storage & DB Insertion with Explicit Error Catches

- [x] **Phase 20.1: Backend Supabase Auth Context Fix (RLS Bypass)** *(Complete)*
  - [x] Extract JWT from request headers in `applyJob` and `analyzeJob`
  - [x] Create authenticated Supabase client for RLS bypass during DB inserts and storage uploads

- [x] **Phase 20.2: Frontend Authorization Header Injection** *(Complete)*
  - [x] Add JWT `Authorization` header to `/api/apply-job` fetch call in `MatchReportPanel.tsx`
  - [x] Add JWT `Authorization` header to `/api/analyze-job` fetch call in `Dashboard.tsx`
  - [x] Verified `/api/hunt-jobs` fetch call in `Dashboard.tsx` already sends the token

- [x] **Phase 21.0: The Autonomous Ghost Brain (Auto-Memory Extraction)** *(Complete)*
  - [x] Backend: Extract JWT & insert into `candidate_memories` in `chatController.ts`
  - [x] Frontend: Pass JWT from `GhostChat.tsx` to `/api/chat`
  - [x] Frontend: Ensure `syncProfile` propagates updates in `UserContext.tsx`

- [x] **Phase 22.0: Final UX Polish & Audit Gap Resolution** *(Complete)*
  - [x] Fix the "Update CV" Button in `ProfileHub.tsx`
  - [x] Resolve the Kanban "Approve" Inconsistency in `Dashboard.tsx`
  - [x] Add the "Last Mile" Application Link in `ResumesPage.tsx` & `CoverLettersPage.tsx`

- [x] **Phase 23.0: Stagehand Integration & The Autonomous Agent Loop** *(Complete)*
  - [x] Install `@browserbasehq/stagehand` and `zod` in backend
  - [x] Extract `generateBespokeDocs()` as shared helper from `jobController.ts`
  - [x] Create `agentController.ts` with Login Wall Triage + JIT doc gen loop
  - [x] Register `POST /api/run-agent` in `server.ts`
  - [x] Update `MatchReportPanel.tsx` with Bottleneck UI and "Submit & Resume" flow

---

## Notes

| Date | Note |
|---|---|
| Project Start | Phase 0 in progress |
