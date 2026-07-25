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

- [ ] **Phase 5: Playwright Execution Arena (WebSockets)**
  - [ ] WebSocket server (backend)
  - [ ] Playwright job application runner
  - [ ] Screenshot streaming to frontend
  - [ ] Human-in-the-loop prompt surface (pause + question card in UI)
  - [ ] Real-time progress bar per application
  - [ ] Session log / transcript of actions taken

---

## Notes

| Date | Note |
|---|---|
| Project Start | Phase 0 in progress |
