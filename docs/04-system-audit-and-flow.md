# ghstCandidate — Phase 19.0 System Audit & Flow Architecture

> **Date:** 2026-07-28
> **Auditor:** Antigravity (full read of all source files)
> **Status:** Brutally honest. Every GAP and BROKEN item is exactly that.

---

## Table of Contents

1. [Authentication & Onboarding Flow](#1-authentication--onboarding-flow)
2. [Dashboard & Sidebar Navigation](#2-dashboard--sidebar-navigation)
3. [The Job Hunting Engines](#3-the-job-hunting-engines-core-workflows)
4. [Document Generation & The Vault](#4-document-generation--the-vault)
5. [AI Identity & Skill Utilization](#5-ai-identity--skill-utilization)
6. [System Health & Metrics](#6-system-health--metrics)
7. [Gap Analysis & Next Steps](#7-gap-analysis--next-steps)

---

## 1. Authentication & Onboarding Flow

### Landing Page (`/`)

**What the user sees:** A fully built, production-quality marketing page composed of:
- `Nav` — sticky header with "Log In" (-> `/auth?mode=login`) and "Sign Up" (-> `/auth?mode=signup`) buttons.
- `Hero` — headline, sub-copy, CTA, and a **static hardcoded Kanban mockup** (not a live component — just JSX with fake data for Stripe, Netflix, etc.).
- `SocialProofBand` — auto-scrolling marquee of company logos from `/public/brand-logos/`.
- `HowItWorks` — 3-column static bento grid.
- `HumanInTheLoop` — static mock "paused application" UI.
- `FinalCTA` + `Footer` — all static, footer links (`Privacy`, `Terms`, `Contact`) point to `href="#"`.

**GAP:** Footer legal links (`Privacy`, `Terms`, `Contact`) are dead `href="#"` — no pages exist.
**GAP:** The hero "Dashboard mock-up" is hardcoded JSX, not a live embed. Fine for marketing, but misrepresents features not yet built (e.g., the "Applied" column implies auto-submission works flawlessly).

---

### Auth Methods (`/auth`)

**Email/Password:** WORKS — Fully wired.
- Sign Up -> `supabase.auth.signUp({ email, password })` -> navigates to `/onboarding`.
- Log In -> `supabase.auth.signInWithPassword({ email, password })` -> navigates to `/dashboard`.
- Error messages are humanized (e.g., "This email is already hunting jobs").
- Split-panel layout with an animated video background (`auth-bg.mp4`).

**Google OAuth:** UI exists, wired to Supabase, but DEPENDS on Supabase project config.
- Frontend calls `supabase.auth.signInWithOAuth({ provider: 'google' })`. This is the correct SDK call.
- **Whether it works depends entirely on whether Google OAuth is enabled in the Supabase dashboard** (Providers -> Google -> Client ID & Secret configured). The code itself is correct.
- After OAuth redirect, `onAuthStateChange` fires, `loadProfile` is called, and `AuthGuard` in `App.tsx` routes the user. OAuth redirect routing relies entirely on `AuthGuard` logic, not `AuthPage` itself.

**LinkedIn OAuth:** Same situation as Google. Uses `provider: 'linkedin_oidc'`. Correct SDK call; depends on Supabase project config.

---

### Routing: Onboarding vs. Dashboard

**The exact logic in `App.tsx` / `AuthGuard`:**

```
User visits /dashboard
  -> AuthGuard: isLoadingAuth? -> show spinner
  -> user is null? -> Navigate to /auth
  -> requireProfile && !hasProfile? -> Navigate to /onboarding
  -> otherwise -> render Dashboard

User visits /onboarding
  -> AuthGuard: blockIfProfile && hasProfile? -> Navigate to /dashboard
  -> otherwise -> render OnboardingFlow
```

`hasProfile` is set in `UserContext` by querying `supabase.from('profiles').select('*').eq('id', userId)`. If a row exists -> `hasProfile = true`.

**Does this execute flawlessly? Mostly yes, with one edge case:**

**GAP:** After `supabase.auth.signUp()` in `AuthPage.tsx`, the code immediately calls `navigate('/onboarding')`. If a sign-up email confirmation is required (depends on Supabase project settings), the user would be navigated to `/onboarding` but their session might not yet be confirmed, causing the AuthGuard to redirect them back to `/auth`. This is a known Supabase edge case and depends on project configuration.

---

### Onboarding Flow (5 Steps)

| Step | What Happens | Status |
|------|-------------|--------|
| 1 | User types name -> `setCandidateProfile({ name })` -> press Enter -> step 2 | WORKS |
| 2 | User uploads PDF -> FileReader -> base64 -> `POST /api/parse-cv` -> Gemini parses -> merges into profile state | WORKS |
| 3 | User adds target roles via tags | WORKS |
| 4 | Work type (Remote/Hybrid/On-site) + city | WORKS |
| 5 | "Go to Dashboard" -> `syncProfile()` -> upserts `profiles` table -> `navigate('/dashboard')` | WORKS |

**GAP:** Step 2 (CV Upload) relies on the **backend being running locally** (`http://localhost:3001`). There is no environment variable for the API base URL — it is hardcoded as `http://localhost:3001` in four components (`OnboardingFlow`, `Dashboard`, `GhostChat`, `MatchReportPanel`). This will break in any hosted/production environment.

---

## 2. Dashboard & Sidebar Navigation

### Sidebar Items

| Nav ID | Label | Icon | What renders |
|--------|-------|------|-------------|
| `dashboard` | Job Tracker | LayoutDashboard | Kanban board + action bar |
| `chat` | Ghost Profiler | Bot | `<GhostChat />` |
| `resumes` | Resumes | FileText | **BROKEN** — see below |
| `profile` | AI Memory & Profile | User | `<ProfileHub />` |
| `settings` | Ghost Settings | Settings | **BROKEN** — see below |

**BROKEN: "Resumes" nav item.** `Dashboard.tsx` conditionally renders `<GhostChat />` for `chat`, `<ProfileHub />` for `profile`, and everything else falls into the default kanban view. There is **no `activePage === 'resumes'` branch** and **no ResumesPage component**. Clicking "Resumes" in the sidebar silently renders the Kanban board.

**BROKEN: "Ghost Settings" nav item.** Same issue — no `activePage === 'settings'` branch exists. Clicking it renders the Kanban board with no indication the user is in the wrong place.

**Sidebar user display is hardcoded.** The bottom of the sidebar shows:
```jsx
<p>Jane Doe</p>
<p>Free tier</p>
```
This is **not connected to `candidateProfile.name`**. Every user sees "Jane Doe" in their sidebar.

---

### Job Tracker (`dashboard`)

- **Data fetch:** On mount, fetches `supabase.from('jobs').select('*').eq('user_id', user.id)`. Real data. WORKS.
- **Kanban columns:** `discovered`, `review`, `applied`. Functional. WORKS.
- **Approve (card-level):** Sets `column = 'applied'` in state + Supabase. WORKS.
- **Reject:** Deletes job from state + Supabase. WORKS.
- **Selected job:** Opens `<MatchReportPanel />` slide-over. WORKS.

**GAP: Two different Approve paths exist.**
- Card-level "Approve" button -> `handleApprove(id)` in `Dashboard.tsx` -> local state update + Supabase column change ONLY.
- `MatchReportPanel` "Approve & Queue" -> calls `/api/apply-job` -> Playwright execution + then calls `onApprove`.

The Kanban card approve **never actually fires the Ghost Worker**. This is an architectural inconsistency — the user may think approving from the card submits the application, but it does not.

---

### Ghost Profiler (`chat`)

- Loads conversation history from `chat_history` table on mount. WORKS.
- If no history exists, triggers an initial greeting from Gemini. WORKS.
- Each message is persisted to `chat_history`. WORKS.
- `profileUpdates` from Gemini are merged into `candidateProfile` state and synced to Supabase. WORKS.

**GAP:** `candidate_memories` table is **never written to by the GhostChat component**. The chat writes new facts to `profiles.extra_data` JSONB. The `candidate_memories` table is only written to by the user manually via ProfileHub. The Ghost Brain does not automatically populate `candidate_memories` when it learns something.

---

### AI Memory & Profile (`profile`) — `<ProfileHub />`

Three tabs:

| Tab | Label | Data Source | Status |
|-----|-------|-------------|--------|
| `profile` | Parsed Profile | `UserContext.candidateProfile` (in memory) | WORKS — shows real data |
| `memory` | Ghost Brain | `supabase.from('candidate_memories').select('*')` | WORKS — reads/writes real data |
| `docs` | Document Vault | `supabase.from('generated_docs').select('*')` | BROKEN — see Section 4 |

**BROKEN: Document Vault "View PDF" button.** The button exists in the UI but has **no `onClick` handler**. Clicking it does nothing.

**GAP: "Update CV" button** in the Profile tab has no `onClick` handler. It is a dead button.

---

## 3. The Job Hunting Engines (Core Workflows)

### Manual Link Processing ("Paste Link" mode)

**Full trace of `POST /api/analyze-job`:**

1. **Frontend** (`Dashboard.tsx` -> `handleRunScraper`):
   - Validates URL starts with `http`.
   - POSTs `{ url, candidateProfile }` to `http://localhost:3001/api/analyze-job`.

2. **Backend** (`jobController.ts` -> `analyzeJob`):
   - Validates URL and `candidateProfile.skills`.
   - Calls `scrapeJobPage(url)` — launches headless Chromium via Playwright with a Chrome user-agent, 30s timeout.
   - Tries to extract text from `main`, `article`, `[data-testid*='job']`, `[class*='job-description']`, falls back to `body.innerText`.
   - If scraped text < 100 chars -> returns `422 Scrape Empty`.
   - Calls `analyzeJobText(jobDescription, candidateProfile, url)`:
     - Truncates job text to 8,000 chars.
     - Builds structured prompt with candidate name, skills, target roles, locations, 1,000 chars of raw resume.
     - Calls Gemini with enforced JSON schema: `{ company, role, matchScore, verdict, matchesFound, missingOrWeak, humanInputRequired }`.
     - Clamps score 0-100.
   - Returns the parsed result.

3. **Frontend** maps result -> `jobs` table row -> inserts into `supabase.from('jobs')` -> displays on Kanban in "review" column.

**Failure States:**

| Failure | How handled |
|---------|------------|
| Playwright timeout / network error | Returns `422 Scrape Failed` with error message. Frontend shows error banner. |
| CAPTCHA detected (during `applyJob`) | Detected via iframe src scan -> returns `400 NEEDS_INPUT`. |
| Page loads but no readable text | Returns `422 Scrape Empty`. |
| Gemini JSON parse error | Throws -> caught by outer try/catch -> `500`. |
| Backend not running | Frontend catches `TypeError: Failed to fetch` -> shows "Network Error: Could not reach the backend server." |

**GAP:** The scrape is dumb text extraction — no Greenhouse/Lever-specific selectors. A Greenhouse embed (e.g., `boards.greenhouse.io`) loads its job description in an iframe. Playwright navigates to the outer page, finds minimal text, and returns a `422 Scrape Empty`. There is **no iframe traversal logic**.

**GAP:** No retry logic. One failed scrape = permanent failure. No exponential backoff.

---

### Automated Data Lake Engine ("Hunt Roles" / "The Hunter")

**Full trace of `POST /api/hunt-jobs`:**

**Step 1 — Build Exclusion List:**
Fetches all `source_url` values from `jobs` where `user_id = userId`. Builds a `Set<string>` of tracked URLs.

**Step 2 — Check the Data Lake (Warm Pool):**
Queries `global_jobs` with `ilike('title', '%role%')` AND `ilike('location', '%location%')`. Limit 50. Filters out tracked URLs.

**Step 3 — API Fallback Engine (if < 5 data lake results):**
- Tries `fetchFromJSearch` (RapidAPI). If 0 results ->
- Tries `fetchFromIndeed` (RapidAPI). If 0 results ->
- Tries `fetchFromReed` (Reed UK). If 0 results ->
- Tries `fetchFromTheirstack`. If 0 results ->
- **If ALL fail -> returns `{ success: true, count: 0, jobs: [] }` with NO user-facing error.** The user sees nothing happen.
- On API success, bulk upserts into `global_jobs` (conflict on `apply_url`).

**Step 4 — Gemini Scoring Loop:**
Takes top 5 jobs. For each: calls `analyzeJobText(job.description, candidateProfile, job.apply_url)`. Inserts each into `jobs` with `column: 'discovered'`.

**Step 5 — Frontend refreshes from Supabase.**

**GAP: Cron has no Authorization header -> BROKEN for multi-user.** `cron.ts` calls `/api/hunt-jobs` with no `Authorization` header. The backend falls back to the service-role Supabase client, bypassing RLS. If `SUPABASE_KEY` is the anon key, all Supabase operations fail silently.

**GAP: `fetchFromIndeed` response shape is likely wrong.** The adapter assumes `response.data` is a direct array, but many Indeed scraper APIs return `{ data: [...] }`. If the shape differs, `!Array.isArray(data)` returns `[]` silently with no error.

**GAP: TheirStack ignores location entirely.** `fetchFromTheirstack` sends `job_title_or: [searchRole]` with **no location filter**. Returns global results regardless of user preference.

---

## 4. Document Generation & The Vault

### What Actually Happens When "Approve & Queue" Is Clicked

From `MatchReportPanel.tsx` -> `handleApprove` -> `POST /api/apply-job`:

1. Backend (`applyJob`) launches a headless Playwright browser.
2. Detects CAPTCHA/password gates -> returns `NEEDS_INPUT` if found.
3. **Scrapes the job page AGAIN** (second Playwright session) to get JD text.
4. Calls Gemini to generate `{ resumeHtml, coverLetterHtml }`.
5. Renders each HTML document using `page.setContent()`.
6. Saves to **`temp_resume.pdf` and `temp_cover_letter.pdf` in the backend's local working directory**.

These two files currently exist on disk at `backend/temp_resume.pdf` (58KB) and `backend/temp_cover_letter.pdf` (52KB).

### Are PDFs Saved to Supabase Storage?

**BROKEN: No.** The PDFs are saved to local temp files on the server's filesystem. There is:
- No call to `supabase.storage.from('documents').upload(...)`.
- No entry written to `generated_docs` table.
- No unique filename — every generation overwrites the same two files.
- If the backend restarts, the files are gone.

### Can the User View/Download Past Generated Files?

**BROKEN: No — on three levels:**
1. The backend never writes a row to `generated_docs`. `loadDocs()` in ProfileHub always returns an empty array.
2. Even if the table had rows, `file_path` would be a local filesystem path (`temp_resume.pdf`) the frontend cannot access. No Supabase Storage bucket is configured.
3. The "View PDF" button in the Document Vault has **no `onClick` handler** — it is a dead button.

---

## 5. AI Identity & Skill Utilization

### How the Ghost Knows Who the User Is

**Source 1 — `candidateProfile` (in-memory, `UserContext`):**
Populated during onboarding from CV parsing. Contains: `name`, `email`, `skills[]`, `targetRoles[]`, `locations[]`, `rawResumeText`.

**Source 2 — `profiles.extra_data` (JSONB in Supabase):**
Dynamic facts learned by GhostChat (e.g., `githubUrl`, `salaryExpectation`, `visaStatus`). Merged into `candidateProfile` on load.

**Source 3 — `candidate_memories` (discrete fact table):**
Manually added by users only. **Never automatically written to by any AI component. Never read by any AI prompt.**

### How Context Is Injected Into Gemini Prompts

**For job scoring (`analyzeJobText`):**
```
## Candidate Profile
- Name: {name}
- Skills: {skills.join(", ")}
- Target Roles: {targetRoles.join(", ")}
- Locations: {locations.join(", ")}
- Raw Resume Context: {rawResumeText.slice(0, 1000)}
```
`candidate_memories` are **NOT included**. Only the core profile is used.

**For document generation (`applyJob`):**
```
Candidate Profile: {JSON.stringify(candidateProfile)}
Job Description: {jdText.slice(0, 5000)}
```
`candidateProfile` includes `extra_data` fields. `candidate_memories` are **NOT included**.

**For GhostChat (`chatProfiler`):**
```
Candidate Profile: {JSON.stringify(currentProfile)}
Chat History: {JSON.stringify(chatHistory)}
User Message: {userMessage}
```
`candidate_memories` are **NOT included** here either.

### Is the UI Dynamically Showing How AI Used Skills?

**Partially.** The `MatchReportPanel` renders:
- **"Skill Matrix"** — `matchesFound` (green) and `missingOrWeak` (amber). Dynamically generated by Gemini. WORKS.
- **"Execution Plan"** — two static items ("Generating a tailored resume variant...", "Auto-answering EEOC questions") plus dynamic `humanInputRequired` warnings. The static items are not AI-driven — they're UI copy.
- **"The Ghost's Verdict"** — full Gemini-generated paragraph. WORKS.

**GAP:** `candidate_memories` are **fully disconnected from the Gemini scoring pipeline**. If a user adds "Preferred Framework: Next.js" as a memory fact, that fact is **never injected** into job scoring or document generation prompts. The Ghost Brain is a display-only feature that has zero effect on AI behavior.

**GAP:** No attribution layer — nothing in the UI indicates whether a skill match came from CV skills, target roles, or a fact the user told the Ghost Profiler.

---

## 6. System Health & Metrics

### What Is Currently Tracked?

**Nothing, systematically.** There is no metrics, telemetry, or analytics layer anywhere in the codebase.

Observability is limited to:
- `console.log` statements in the backend.
- `console.error` for failures.
- None of these are aggregated, stored, or surfaced in any UI.

### Specific Gaps Preventing Reliability Knowledge

| Metric | Gap |
|--------|-----|
| % of links successfully scraped | Not tracked. Scrape failures logged to console only. No historical data. |
| % of API calls returning 0 results | Console log only. No persistent record. |
| Jobs tracked vs. applied | Derivable from `jobs.column` field in Supabase but no endpoint or UI calculates this. |
| Gemini scoring error rate | Not tracked. Generic `500` handler. |
| Auto-apply success/failure rate | Cron logs to console. `jobs.column = 'applied'` and `jobs.needs_input = true` are the only persistent signals, but they're not aggregated. |
| API key exhaustion / rate limiting | Not handled. Rate limit errors from RapidAPI look identical to "0 results" — both return `[]`. No distinction, no alert. |

---

## 7. Gap Analysis & Next Steps

### Top 3 Critical Issues (By Severity)

---

**CRITICAL #1: Backend API URL is Hardcoded to `localhost:3001`**

Files affected: `OnboardingFlow.tsx`, `Dashboard.tsx`, `GhostChat.tsx`, `MatchReportPanel.tsx`.
Impact: The application **cannot be deployed** to any hosting environment. Every fetch call will fail in production. This is the single biggest barrier to launch.
Fix: Extract `VITE_API_BASE_URL` to `frontend/.env.local`, create an `apiClient.ts` utility, replace all hardcoded `http://localhost:3001` references.

---

**CRITICAL #2: Document Generation Writes to Temp Files, Not Supabase Storage**

Files affected: `jobController.ts` (`applyJob`), `ProfileHub.tsx` (Document Vault tab).
Impact: Generated CVs and cover letters are ephemeral, non-unique (overwrite each other), and completely inaccessible to users. The Document Vault UI is 100% non-functional — the table is always empty, and the "View PDF" button is dead.
Fix:
1. Generate unique filenames (`userId-timestamp-cv.pdf`).
2. Upload to a `documents` Supabase Storage bucket.
3. Insert a row into `generated_docs` with `file_path` = the storage path.
4. Wire the "View PDF" button to `supabase.storage.from('documents').getPublicUrl(file_path)`.

---

**CRITICAL #3: `candidate_memories` Are Fully Disconnected From the AI Pipeline**

Files affected: `chatController.ts`, `jobController.ts` (`analyzeJobText` and `applyJob`).
Impact: The "Ghost Brain" feature — the AI Memory page's key differentiator — is **purely cosmetic**. Facts added to `candidate_memories` are never used by Gemini during scoring or document generation. The system is lying to the user about how intelligent it is.
Fix: Before calling Gemini in `analyzeJobText` and `applyJob`, fetch the user's `candidate_memories` from Supabase and append them to the prompt context block.

---

### Prioritized Production Readiness Checklist

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Replace hardcoded `localhost:3001` with env-var API client | Low | Enables deployment |
| 2 | Fix Document Vault: Supabase Storage upload + `generated_docs` write + "View PDF" button | Medium | Core feature works |
| 3 | Inject `candidate_memories` into Gemini prompts | Low | AI actually uses learned facts |
| 4 | Fix Sidebar: add `resumes` and `settings` page branches | Medium | Removes ghost nav items |
| 5 | Fix sidebar user display: show real `candidateProfile.name` | Trivial | Basic personalization |
| 6 | Fix GhostChat: auto-write to `candidate_memories` when it learns a new fact | Medium | Brain actually learns |
| 7 | Add Greenhouse/Lever iframe scraping support | High | Core scraper reliability |
| 8 | Fix cron auth: pass service-role key explicitly for background operations | Low | Multi-user cron safety |
| 9 | Fix TheirStack: add location filter to API call | Trivial | Relevance of results |
| 10 | Add a metrics/observability store (`api_logs` table or similar) | High | System reliability visibility |
| 11 | Resolve two Approve paths (Kanban card vs. MatchReportPanel) | Medium | UX clarity + correct behavior |
| 12 | Add retry logic to scraper | Medium | Resilience |
| 13 | Wire "Update CV" button in ProfileHub | Low | UX completeness |

---

## Appendix: What Is Actually Working Right Now

| Feature | Status |
|---------|--------|
| Landing page renders | WORKS |
| Email sign-up and login | WORKS |
| AuthGuard routing (onboarding vs. dashboard) | WORKS |
| Onboarding 5-step flow | WORKS |
| CV PDF parsing (Gemini reads PDF) | WORKS |
| Profile persists to Supabase | WORKS |
| Kanban board loads real jobs from Supabase | WORKS |
| Approve/Reject (state + DB update) | WORKS |
| Manual link scraping + Gemini scoring | WORKS (when backend is running) |
| Hunt Roles: Data Lake cache + API fallback | WORKS (when API keys configured) |
| Hunt Roles: Gemini scores and inserts jobs | WORKS |
| MatchReportPanel: skill matrix, verdict, execution plan | WORKS |
| GhostChat: conversation history, profile updates via chat | WORKS |
| AI Memory page: read/add/delete memories manually | WORKS |
| Cron: 4-hour background hunt + auto-apply cycle | WORKS (auth caveat applies) |
| NEEDS_INPUT graceful failure + Ghost pulse animation | WORKS |
| Document generation (HTML -> PDF) | WORKS (temp files only, not persisted) |
| OAuth UI (Google, LinkedIn) | WORKS (depends on Supabase project config) |
