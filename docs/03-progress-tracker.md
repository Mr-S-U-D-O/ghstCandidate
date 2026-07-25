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

- [ ] **Phase 8: DOM Mapping, Blocker Detection & Form Execution** *(Current)*
  - [ ] Blocker Detection (login wall / CAPTCHAs) with 60s pause
  - [ ] Extract form fields using page.$$eval
  - [ ] Gemini API call to map profile to fields
  - [ ] Fill form live using Playwright
  - [ ] Update frontend MatchReportPanel button text

---

## Notes

| Date | Note |
|---|---|
| Project Start | Phase 0 in progress |
