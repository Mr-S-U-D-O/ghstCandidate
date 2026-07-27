# Diagnostic: Execution Pipeline Breakdown

This document provides a highly detailed technical mapping of the current Job Application Execution Engine based on the state of `jobController.ts` and the frontend application components.

## 1. The Trigger & Initialization

### Direct URL Paste vs. The Hunter
*   **Direct URL Paste (`Dashboard.tsx`)**: The user pastes a job URL and clicks "Run AI Scraper". The frontend makes a POST request to `/api/analyze-job` with the `url` and the `candidateProfile` (extracted from the React `UserContext`). The backend scrapes the URL, analyzes the job using Gemini, and returns a JSON payload. The frontend then manually persists this analyzed job as a new row into the Supabase `jobs` table, defaulting to the `review` column.
*   **The Hunter (`Dashboard.tsx`)**: The user inputs a target role and location. The frontend calls `/api/hunt-jobs` with `searchRole`, `location`, `candidateProfile` (from `UserContext`), and `userId`. The backend launches a headless Playwright instance, scrapes LinkedIn's public job search, loops through the top job links, analyzes their descriptions via Gemini, and **directly inserts** them into the Supabase `jobs` table (placing them in the `review` column if the match score is > 75, otherwise `discovered`).

### Injecting Profile Data
For initial *analysis* and *hunting*, the `candidateProfile` object is successfully injected from the frontend `UserContext` via the API body payload. 

**Critical Diagnostic Note**: During the actual **Execution Phase** (when the user clicks "Approve & Queue" in `MatchReportPanel.tsx`), the frontend currently hardcodes the `candidateProfile` as an empty object in the request body to `/api/apply-job`:
```typescript
body: JSON.stringify({
  jobUrl: job.sourceUrl || "https://example.com/mock-job",
  candidateProfile: {} // <-- HARDCODED EMPTY OBJECT
})
```
This means the backend receives no real profile context during the form-filling stage.

## 2. The Playwright Engine & DOM Extraction

### Initial Navigation
When the `applyJob` endpoint is triggered, the backend launches a headless Chromium instance and navigates to the target `jobUrl`. It waits for the `domcontentloaded` event with a strict 30,000ms timeout.

### Immediate Blocker Detection
Before attempting to extract any form data, Playwright scans the DOM for immediate blockers:
*   Checks for the presence of any `input[type="password"]` to detect login walls.
*   Checks `iframe` sources for substrings like `captcha`, `turnstile`, or `challenge` to detect bot protection.
If either is found, execution halts immediately without consulting Gemini.

### DOM Extraction & Packaging
If the page is clear, Playwright extracts interactive form elements by querying:
`input[type="text"], input[type="email"], input[type="file"], textarea, select`

For each matching element, it extracts:
1.  `id` and `name` attributes.
2.  `type` (or tagName if no type exists).
3.  `label` text (by searching for a linked `<label for="id">` or a wrapping parent `<label>`).

These extracted fields, along with the injected `candidateProfile` (currently `{}`), are serialized into JSON strings and injected directly into a prompt template to be sent to Gemini.

## 3. The Gemini Mapping Phase

### Evaluation Logic
The backend instantiates the Gemini model (`gemini-flash-lite-latest` by default) and requests a JSON array response. The prompt explicitly casts Gemini as an "expert form-filling AI" and provides the serialized candidate profile and form fields.

### Determining What to Type, Click, and Missing Data
Gemini is instructed to map the profile data to the extracted form fields based on context. 
*   **What to type**: It returns an array of objects structured as `{ elementName, value }` representing its decisions.
*   **What to click**: Currently, the engine only focuses on filling textual inputs, dropdowns (`select`), and files. Checkboxes and radios are not explicitly handled in the extraction or filling logic.
*   **Missing Data Logic**: Gemini is given a strict fallback directive: *"If you CANNOT find the answer to a required field in the candidate profile, set its value to exactly the string 'UNKNOWN_REQUIRED_INPUT'"*.

*Note: Even though Gemini might return a text value for file uploads, the execution loop hardcodes `el.setInputFiles('uploads/dummy_resume.pdf')` for any element identified as `type="file"`.*

## 4. Branching Outcomes & Failure States

### Scenario A: Complete Success
If Gemini maps all fields successfully (none are flagged as `UNKNOWN_REQUIRED_INPUT`), the backend iterates over the mapped actions:
1.  It queries the DOM using `[name="{elementName}"], #{elementName}`.
2.  For text/email/selects, it runs `el.fill(action.value)`.
3.  For files, it runs `el.setInputFiles('uploads/dummy_resume.pdf')`.
4.  After filling, it pauses for 2,000ms, closes the browser, and returns a `200 OK` success response to the frontend.

### Scenario B: Login Wall
If Playwright detects a password input during the initial navigation phase:
1.  **Backend**: Aborts headless execution instantly. Returns a `400 Bad Request` with `status: "NEEDS_INPUT"` and `missingField: "Login required — manual sign-in needed"`.
2.  **Frontend**: `MatchReportPanel.tsx` catches the `NEEDS_INPUT` status, sets an error in the UI panel, and calls `onNeedsInput`.
3.  **Supabase/State**: The `Dashboard.tsx` updates the job's state (and Supabase row) to flag `needs_input: true` and sets the `missing_field`. It also triggers a UI pulse effect on the "Ghost Profiler" navigation tab to alert the user.

### Scenario C: CAPTCHA / Bot Protection
If Playwright detects a CAPTCHA iframe during the initial navigation phase:
1.  **Backend**: Aborts execution instantly. Returns a `400 Bad Request` with `status: "NEEDS_INPUT"` and `missingField: "CAPTCHA / challenge detected"`.
2.  **Frontend/Supabase**: Handled exactly the same as Scenario B. The job is flagged as needing input and the user is directed to the Ghost Profiler.

### Scenario D: Missing Human Input
If Gemini evaluates the form fields but determines the profile lacks the necessary context to answer a question (e.g., "What is your desired salary?"):
1.  **Gemini**: Returns `"UNKNOWN_REQUIRED_INPUT"` as the value for that specific `elementName`.
2.  **Backend**: Before touching the DOM, the backend scans the mapped actions array. If it detects this sentinel value, it aborts execution entirely (no fields are filled). It returns a `400 Bad Request` with `status: "NEEDS_INPUT"` and sets `missingField` to the specific field's name/label.
3.  **Frontend/Supabase**: Handled identically to Scenarios B & C. The specific missing question is displayed as an error, the job row is updated in Supabase to `needs_input: true` with the missing field recorded, and the Ghost Profiler tab begins pulsing to prompt the user to provide the missing data.
