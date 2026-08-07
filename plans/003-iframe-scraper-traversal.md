# Plan 003: Implement Iframe Traversal for ATS Scraper

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ca43d9d..HEAD -- backend/src/controllers/jobController.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ca43d9d`, 2026-08-07

## Why this matters

The Tier-4 Playwright scraper currently only extracts text from the main document body. Many Applicant Tracking Systems (ATS), notably Greenhouse, embed the actual job description inside an iframe (`id="grnhse_iframe"`). When analyzing these URLs, the scraper returns "Extraction Empty" because it misses the iframe content. Implementing a simple iframe traversal step significantly boosts scraper reliability on ATS boards.

## Current state

- `backend/src/controllers/jobController.ts` — The `scrapeJobPagePlaywright` function (lines 105-133) only checks `document.querySelector` on the main page.

Excerpt from `backend/src/controllers/jobController.ts`:
```typescript
    const text = await page.evaluate(() => {
      const selectors = ["main", "article", "[data-testid*='job']", "[class*='job-description']", "body"]
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (el) {
          const t = (el as HTMLElement).innerText?.trim()
          if (t && t.length > 200) return t
        }
      }
      return document.body.innerText?.trim() ?? ""
    })

    return text
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build | `cd backend && npm run build` | exit 0, no typescript errors |

## Scope

**In scope**:
- `backend/src/controllers/jobController.ts`

**Out of scope**:
- Changing the `analyzeJob` endpoints or how Playwright is instantiated.
- Adding complex multi-page crawling logic.

## Git workflow

- Branch: `advisor/003-iframe-scraper-traversal`
- Commit message: `fix: add iframe traversal to Playwright scraper for ATS embeds`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add iframe extraction logic to `scrapeJobPagePlaywright`

In `backend/src/controllers/jobController.ts`, modify `scrapeJobPagePlaywright` to extract text from iframes if the main page text is insufficient. Playwright's `page.frames()` allows access to child frames.

Update the function to look like this:

```typescript
async function scrapeJobPagePlaywright(url: string): Promise<string> {
  console.log(`[Tier-4/Playwright] Launching headless Chromium for: ${url}`)
  const browser = await chromium.launch({ headless: process.env.HEADLESS === 'false' ? false : true, slowMo: 100 })
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })
    const page = await context.newPage()

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(1500)

    let text = await page.evaluate(() => {
      const selectors = ["main", "article", "[data-testid*='job']", "[class*='job-description']", "body"]
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (el) {
          const t = (el as HTMLElement).innerText?.trim()
          if (t && t.length > 200) return t
        }
      }
      return document.body.innerText?.trim() ?? ""
    })

    // Iframe Traversal for ATS Embeds (e.g., Greenhouse)
    if (text.length < 500) {
      console.log(`[Tier-4/Playwright] Main page text < 500 chars. Checking iframes...`)
      const frames = page.frames()
      for (const frame of frames) {
        // Skip the main page frame
        if (frame === page.mainFrame()) continue

        try {
          const frameText = await frame.evaluate(() => document.body.innerText?.trim() ?? "")
          if (frameText && frameText.length > 200) {
            console.log(`[Tier-4/Playwright] Found significant text in iframe: ${frame.url()}`)
            text += "\\n" + frameText
          }
        } catch (e) {
          // Ignore cross-origin frame errors if any
          console.warn(`[Tier-4/Playwright] Could not read iframe text:`, e)
        }
      }
    }

    return text
  } finally {
    await browser.close()
  }
}
```

**Verify**: `cd backend && npm run build` → exits 0 without type errors.

## Test plan

- Verification: `cd backend && npm run build` → ensures no TS or build errors were introduced.

## Done criteria

- [ ] `cd backend && npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- You encounter an issue with `page.frames()` missing from the Playwright API version.

## Maintenance notes

- Some cross-origin iframes may still block `frame.evaluate()` depending on security policies, but many ATS embeds configure their headers to allow it for legitimate host sites.
