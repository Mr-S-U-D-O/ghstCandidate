import { Request, Response } from "express"
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import { chromium } from "playwright"

// ── Types ──────────────────────────────────────────────────────────

export interface CandidateProfile {
  name?: string
  skills: string[]
  experience: string
  preferences: {
    roles: string[]
    workType: string
    location?: string
  }
}

export interface AnalyzeJobPayload {
  url: string
  candidateProfile: CandidateProfile
}

export interface JobAnalysisResult {
  company: string
  role: string
  matchScore: number
  verdict: string
  matchesFound: string[]
  missingOrWeak: string[]
  humanInputRequired: string[]
}

// ── Gemini Client (lazy singleton) ────────────────────────────────

let _genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error("GEMINI_API_KEY is not set in environment variables.")
    _genAI = new GoogleGenerativeAI(key)
  }
  return _genAI
}

// ── Gemini Response Schema ─────────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    company:  { type: SchemaType.STRING, description: "Company name extracted from the job description" },
    role:     { type: SchemaType.STRING, description: "Job title extracted from the job description" },
    matchScore: { type: SchemaType.NUMBER, description: "Integer 0-100: how well the candidate matches this role" },
    verdict:  { type: SchemaType.STRING, description: "2-3 sentence honest summary. Reference specific skills or requirements from the JD." },
    matchesFound: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "3-5 specific skills/experiences from the candidate profile that match the JD requirements"
    },
    missingOrWeak: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "1-3 honest skill gaps relative to the JD. Empty array if none."
    },
    humanInputRequired: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Fields the Ghost cannot auto-fill: salary, visa, portfolio, cover letter. Empty array if none."
    }
  },
  required: ["company", "role", "matchScore", "verdict", "matchesFound", "missingOrWeak", "humanInputRequired"]
}

// ── Playwright Scraper ─────────────────────────────────────────────

async function scrapeJobPage(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })
    const page = await context.newPage()

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })

    // Wait briefly for any lazy-loaded content
    await page.waitForTimeout(1500)

    // Extract main text — prefer <main> or <article> if available, fall back to body
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
  } finally {
    await browser.close()
  }
}

// ── Controller ────────────────────────────────────────────────────

export async function analyzeJob(req: Request, res: Response): Promise<void> {
  try {
    const { url, candidateProfile } = req.body as AnalyzeJobPayload

    // Validate
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      res.status(400).json({ error: "Bad Request", message: "A valid http(s) URL is required." })
      return
    }
    if (!candidateProfile || !Array.isArray(candidateProfile.skills) || !candidateProfile.experience) {
      res.status(400).json({ error: "Bad Request", message: "candidateProfile with skills[] and experience is required." })
      return
    }

    // Step 1: Scrape the job page
    console.log(`[analyzeJob] Scraping: ${url}`)
    let jobDescription: string
    try {
      jobDescription = await scrapeJobPage(url)
    } catch (scrapeErr) {
      const msg = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)
      console.error("[analyzeJob] Playwright scrape failed:", msg)
      res.status(422).json({ error: "Scrape Failed", message: `Could not load the URL. ${msg}` })
      return
    }

    if (!jobDescription || jobDescription.length < 100) {
      res.status(422).json({ error: "Scrape Empty", message: "The page loaded but contained no readable job content." })
      return
    }

    // Truncate to keep token count sane (~8000 chars)
    const truncated = jobDescription.slice(0, 8000)
    console.log(`[analyzeJob] Scraped ${jobDescription.length} chars, sending ${truncated.length} to Gemini`)

    // Step 2: Build prompt
    const prompt = `
You are the Ghost Worker — an elite technical recruiter AI embedded in the ghstCandidate platform.

Analyse the job posting text below against the candidate profile. Be honest, technical, and specific.
Do NOT hallucinate skills. Do NOT give inflated match scores.

## Candidate Profile
- Name: ${candidateProfile.name ?? "Anonymous"}
- Skills: ${candidateProfile.skills.join(", ")}
- Experience: ${candidateProfile.experience}
- Target Roles: ${candidateProfile.preferences.roles.join(", ")}
- Work Type: ${candidateProfile.preferences.workType}
- Location: ${candidateProfile.preferences.location ?? "No preference"}

## Job Posting (scraped from: ${url})
${truncated}

## Your Task
- Extract the company name and exact job title.
- Score the match 0-100 honestly.
- List 3-5 concrete matches between the candidate and this specific JD.
- List 1-3 real gaps. Empty array if none.
- List any application fields a bot cannot fill (salary, visa, cover letter). Empty array if none.
- Write a verdict: 2-3 sentences, specific to THIS pairing.
`.trim()

    // Step 3: Call Gemini
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any,
      },
    })

    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()

    // Step 4: Parse (schema enforcement makes this reliable, but guard anyway)
    let parsed: JobAnalysisResult
    try {
      parsed = JSON.parse(rawText) as JobAnalysisResult
    } catch {
      console.error("[analyzeJob] Gemini returned non-JSON:", rawText)
      res.status(502).json({ error: "Parse Error", message: "Gemini returned an unexpected format.", raw: rawText })
      return
    }

    // Clamp score
    parsed.matchScore = Math.max(0, Math.min(100, Math.round(parsed.matchScore)))

    console.log(`[analyzeJob] Done — "${parsed.role}" at "${parsed.company}" | score: ${parsed.matchScore}`)
    res.json(parsed)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[analyzeJob] Unhandled error:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  }
}

// ── Application Runner ─────────────────────────────────────────────

export async function applyJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobUrl, candidateProfile } = req.body

    if (!jobUrl || typeof jobUrl !== "string") {
      res.status(400).json({ error: "Bad Request", message: "A valid jobUrl is required." })
      return
    }

    console.log(`[applyJob] Starting execution engine for: ${jobUrl}`)

    // 1. Launch Chromium in Visible Mode with slowMo
    const browser = await chromium.launch({ headless: false, slowMo: 100 })
    try {
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      })
      const page = await context.newPage()

      // 2. Navigate to URL
      console.log(`[applyJob] Navigating...`)
      await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 })

      // 3. Blocker Detection
      const hasPassword = await page.$('input[type="password"]')
      const iframes = await page.$$eval('iframe', frames => frames.map(f => f.src.toLowerCase()))
      const hasCaptcha = iframes.some(src => src.includes('captcha') || src.includes('turnstile') || src.includes('challenge'))

      if (hasPassword || hasCaptcha) {
        console.warn(`[applyJob] Blocker detected (Password: ${!!hasPassword}, Captcha: ${hasCaptcha}). Waiting 60 seconds for manual user resolution in the browser...`)
        await page.waitForTimeout(60000)
      }

      // 4. Extract Form Fields
      console.log(`[applyJob] Extracting interactive form elements...`)
      const fields = await page.$$eval('input[type="text"], input[type="email"], input[type="file"], textarea, select', elements => {
        return elements.map(el => {
          const id = el.id || ''
          const name = (el as HTMLInputElement).name || ''
          const type = (el as HTMLInputElement).type || el.tagName.toLowerCase()
          let labelText = ''
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`) as HTMLLabelElement
            if (label) labelText = label.innerText.trim()
          }
          if (!labelText) {
             const parentLabel = el.closest('label')
             if (parentLabel) labelText = (parentLabel as HTMLLabelElement).innerText.trim()
          }
          return { id, name, type, label: labelText }
        })
      })
      console.log(`[applyJob] Extracted ${fields.length} fields.`)

      // 5. Ask Gemini to map fields
      let mappedActions: { elementName: string, value: string }[] = []
      if (fields.length > 0) {
        console.log(`[applyJob] Asking Gemini to map candidate profile to fields...`)
        try {
          const genAI = getGenAI()
          const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest", 
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  elementName: { type: SchemaType.STRING },
                  value: { type: SchemaType.STRING }
                },
                required: ["elementName", "value"]
              }
            } as any
          }
        })
        const prompt = `
You are an expert form-filling AI.
Candidate Profile: ${JSON.stringify(candidateProfile)}
Extracted Form Fields: ${JSON.stringify(fields)}

Map the candidate profile to the extracted fields. 
Return a JSON array of objects with "elementName" (use the name or id from the fields) and "value" to type in. 
If a field cannot be answered with the profile, omit it or guess reasonably (e.g. for checkboxes/dropdowns if appropriate).
`.trim()
          const result = await model.generateContent(prompt)
          const rawText = result.response.text().trim()
          mappedActions = JSON.parse(rawText)
        } catch (e) {
          console.error(`\x1b[31m[applyJob] AI Mapping Failed: ${(e as Error).message}\x1b[0m`)
        }
      }

      // 6. Playwright Execution
      console.log(`[applyJob] Executing form fills...`)
      for (const action of mappedActions) {
        if (!action.elementName) continue
        try {
          const selector = `[name="${action.elementName}"], #${action.elementName}`
          const el = await page.$(selector)
          if (el) {
            const type = await el.evaluate(e => (e as HTMLInputElement).type)
            if (type === 'file') {
              await el.setInputFiles('uploads/dummy_resume.pdf', { timeout: 2000 })
              console.log(`  - Uploaded dummy_resume.pdf to ${action.elementName}`)
            } else {
              await el.fill(action.value, { timeout: 2000 })
              console.log(`  - Filled ${action.elementName} with "${action.value}"`)
            }
          } else {
            console.warn(`  - Element not found for ${action.elementName}`)
          }
        } catch (e) {
          console.warn(`  - Failed to fill ${action.elementName}:`, (e as Error).message)
        }
      }

      // 7. Verification Pause
      console.log(`[applyJob] Pausing for 5 seconds for visual verification...`)
      await page.waitForTimeout(5000)

    } finally {
      await browser.close()
      console.log(`[applyJob] Execution complete. Browser closed.`)
    }

    res.status(200).json({ 
      success: true, 
      message: "The Ghost has successfully submitted your application." 
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[applyJob] Execution failed:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  }
}
