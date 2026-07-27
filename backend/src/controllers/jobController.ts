import { Request, Response } from "express"
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import { chromium, BrowserContext } from "playwright"
import { supabase } from "../supabaseClient.js"
import { createClient } from "@supabase/supabase-js"

// ── Types ──────────────────────────────────────────────────────────

export interface CandidateProfile {
  name: string
  email: string
  targetRoles: string[]
  locations: string[]
  skills: string[]
  rawResumeText: string
  [key: string]: any
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

export async function analyzeJobText(jobText: string, candidateProfile: CandidateProfile, url: string): Promise<JobAnalysisResult> {
  const truncated = jobText.slice(0, 8000)

  // Step 2: Build prompt
  const prompt = `
You are the Ghost Worker — an elite technical recruiter AI embedded in the ghstCandidate platform.

Analyse the job posting text below against the candidate profile. Be honest, technical, and specific.
Do NOT hallucinate skills. Do NOT give inflated match scores.

## Candidate Profile
- Name: ${candidateProfile.name ?? "Anonymous"}
- Skills: ${candidateProfile.skills.join(", ")}
- Target Roles: ${candidateProfile.targetRoles.join(", ")}
- Locations: ${candidateProfile.locations.join(", ")}
- Raw Resume Context: ${candidateProfile.rawResumeText.slice(0, 1000)}

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

  // Step 4: Parse
  let parsed: JobAnalysisResult
  try {
    parsed = JSON.parse(rawText) as JobAnalysisResult
  } catch (e) {
    throw new Error(`Gemini parse error: ${rawText}`)
  }

  // Clamp score
  parsed.matchScore = Math.max(0, Math.min(100, Math.round(parsed.matchScore)))
  return parsed
}

export async function analyzeJob(req: Request, res: Response): Promise<void> {
  try {
    const { url, candidateProfile } = req.body as AnalyzeJobPayload

    // Validate
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      res.status(400).json({ error: "Bad Request", message: "A valid http(s) URL is required." })
      return
    }
    if (!candidateProfile || !Array.isArray(candidateProfile.skills)) {
      res.status(400).json({ error: "Bad Request", message: "candidateProfile is missing required fields." })
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

    const parsed = await analyzeJobText(jobDescription, candidateProfile, url)
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
  const browser = await chromium.launch({ headless: true })
  try {
    const { jobUrl, candidateProfile } = req.body

    if (!jobUrl || typeof jobUrl !== "string") {
      await browser.close()
      res.status(400).json({ error: "Bad Request", message: "A valid jobUrl is required." })
      return
    }

    console.log(`[applyJob] Starting headless execution engine for: ${jobUrl}`)

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })
    const page = await context.newPage()

    // 1. Navigate to URL
    console.log(`[applyJob] Navigating...`)
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 })

    // 2. Blocker Detection (headless — log and continue, don't wait 60s)
    const hasPassword = await page.$('input[type="password"]')
    const iframes = await page.$$eval('iframe', frames => frames.map(f => f.src.toLowerCase()))
    const hasCaptcha = iframes.some(src => src.includes('captcha') || src.includes('turnstile') || src.includes('challenge'))

    if (hasPassword || hasCaptcha) {
      console.warn(`[applyJob] Blocker detected (Password: ${!!hasPassword}, Captcha: ${hasCaptcha}). Aborting — cannot resolve in headless mode.`)
      await browser.close()
      res.status(400).json({
        success: false,
        status: "NEEDS_INPUT",
        missingField: hasPassword ? "Login required — manual sign-in needed" : "CAPTCHA / challenge detected"
      })
      return
    }

    // 2.5 Generate Bespoke Documents
    console.log(`[applyJob] Generating bespoke Resume and Cover Letter...`)
    const jdText = await scrapeJobPage(jobUrl)
    const docGenPrompt = `
You are an expert resume and cover letter writer.
Candidate Profile: ${JSON.stringify(candidateProfile)}
Job Description: ${jdText.slice(0, 5000)}

Generate a highly tailored Resume and a Cover Letter for this specific job.
Return a JSON object with two keys: "resumeHtml" and "coverLetterHtml".
STRICT STYLING REQUIREMENTS FOR HTML:
- Minimalist, achromatic color palette (black, white, grays).
- Whitespace dominant (high padding/margins).
- No gradients, no emojis.
- Headings MUST use 'Comfortaa' font via Google Fonts (<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&display=swap" rel="stylesheet">).
- Body text MUST use 'Lato' font via Google Fonts (<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">).
- Use inline styles or a <style> block.
`.trim()

    try {
      const docGenAI = getGenAI()
      const docModel = docGenAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              resumeHtml: { type: SchemaType.STRING },
              coverLetterHtml: { type: SchemaType.STRING }
            },
            required: ["resumeHtml", "coverLetterHtml"]
          } as any
        }
      })
      const docResult = await docModel.generateContent(docGenPrompt)
      const docs = JSON.parse(docResult.response.text().trim())
      
      const renderContext = await browser.newContext()
      const renderPage = await renderContext.newPage()
      
      await renderPage.setContent(docs.resumeHtml, { waitUntil: "networkidle" })
      await renderPage.pdf({ path: 'temp_resume.pdf', format: 'A4' })
      
      await renderPage.setContent(docs.coverLetterHtml, { waitUntil: "networkidle" })
      await renderPage.pdf({ path: 'temp_cover_letter.pdf', format: 'A4' })
      
      await renderContext.close()
      console.log(`[applyJob] Successfully generated temp_resume.pdf and temp_cover_letter.pdf`)
    } catch (e) {
      console.error(`[applyJob] Failed to generate bespoke documents:`, (e as Error).message)
    }

    // 3. Extract Form Fields
    console.log(`[applyJob] Extracting interactive form elements...`)
    const fields = await page.$$eval('input[type="text"], input[type="email"], input[type="file"], input[type="radio"], input[type="checkbox"], textarea, select', elements => {
      return elements.map(el => {
        const id = el.id || ''
        const name = (el as HTMLInputElement).name || ''
        const type = (el as HTMLInputElement).type || el.tagName.toLowerCase()
        const value = (el as HTMLInputElement).value || ''
        let labelText = ''
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`) as HTMLLabelElement
          if (label) labelText = label.innerText.trim()
        }
        if (!labelText) {
          const parentLabel = el.closest('label')
          if (parentLabel) labelText = (parentLabel as HTMLLabelElement).innerText.trim()
        }
        return { id, name, type, value, label: labelText }
      })
    })
    console.log(`[applyJob] Extracted ${fields.length} fields.`)

    // 4. Ask Gemini to map fields — flag unknowns with sentinel value
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
IMPORTANT: If you CANNOT find the answer to a required field in the candidate profile, set its value to exactly the string "UNKNOWN_REQUIRED_INPUT".
Do NOT skip fields — always include every field in your response.
`.trim()

        const result = await model.generateContent(prompt)
        const rawText = result.response.text().trim()
        mappedActions = JSON.parse(rawText)
        console.log(`[applyJob] Gemini returned ${mappedActions.length} mapped actions.`)
      } catch (e) {
        console.error(`\x1b[31m[applyJob] AI Mapping Failed: ${(e as Error).message}\x1b[0m`)
      }
    }

    // 5. Abort Logic: Check for any UNKNOWN_REQUIRED_INPUT before touching the DOM
    const unknownField = mappedActions.find(a => a.value === "UNKNOWN_REQUIRED_INPUT")
    if (unknownField) {
      const fieldLabel = unknownField.elementName
      console.warn(`[applyJob] Aborting — cannot answer required field: "${fieldLabel}"`)
      await browser.close()
      res.status(400).json({
        success: false,
        status: "NEEDS_INPUT",
        missingField: fieldLabel
      })
      return
    }

    // 6. All fields are answerable — execute fills
    console.log(`[applyJob] All fields mapped. Executing form fills...`)
    for (const action of mappedActions) {
      if (!action.elementName) continue
      try {
        // First try for radio/checkbox by specific value
        const radioSelector = `input[name="${action.elementName}"][value="${action.value}"], input#${action.elementName}[value="${action.value}"]`
        const radioEl = await page.$(radioSelector)
        if (radioEl) {
          const type = await radioEl.evaluate(e => (e as HTMLInputElement).type)
          if (type === 'radio' || type === 'checkbox') {
            await radioEl.check({ timeout: 2000 })
            console.log(`  - Checked ${action.elementName} with value "${action.value}"`)
            continue
          }
        }

        // Fallback for regular inputs
        const selector = `[name="${action.elementName}"], #${action.elementName}`
        const el = await page.$(selector)
        if (el) {
          const type = await el.evaluate(e => (e as HTMLInputElement).type)
          if (type === 'file') {
            const isCoverLetter = action.elementName.toLowerCase().includes('cover')
            const fileToUpload = isCoverLetter ? 'temp_cover_letter.pdf' : 'temp_resume.pdf'
            await el.setInputFiles(fileToUpload, { timeout: 2000 })
            console.log(`  - Uploaded ${fileToUpload} to ${action.elementName}`)
          } else {
            await el.fill(action.value, { timeout: 2000 })
            console.log(`  - Filled ${action.elementName} with "${action.value}"`)
          }
        } else {
          console.warn(`  - Element not found for selector: ${action.elementName}`)
        }
      } catch (e) {
        console.warn(`  - Failed to fill ${action.elementName}:`, (e as Error).message)
      }
    }

    // 7. Brief pause then close
    await page.waitForTimeout(2000)
    await browser.close()
    console.log(`[applyJob] Execution complete. Browser closed.`)

    res.status(200).json({
      success: true,
      message: "The Ghost has successfully submitted your application."
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[applyJob] Execution failed:", message)
    try { await browser.close() } catch {}
    res.status(500).json({ error: "Internal Server Error", message })
  }
}

// ── The Hunter (Automated Crawler) ─────────────────────────────────

export async function huntJobs(req: Request, res: Response): Promise<void> {
  const { searchRole, location, candidateProfile, userId } = req.body

  if (!searchRole || !location || !candidateProfile || !userId) {
    res.status(400).json({ error: "Missing parameters" })
    return
  }

  console.log(`[huntJobs] Starting hunt for '${searchRole}' in '${location}' for user ${userId}`)

  const atsDomains = ['boards.greenhouse.io', 'jobs.lever.co', 'apply.workable.com', 'jobs.ashbyhq.com']
  const browser = await chromium.launch({ headless: true })
  let discoveredCount = 0

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })
    const page = await context.newPage()
    
    console.log(`[huntJobs] Initiating sequential ATS Dorking searches on Bing...`)
    
    let allLinks: string[] = []

    for (const domain of atsDomains) {
      const dorkQuery = `${searchRole} ${location} site:${domain}`
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(dorkQuery)}`
      
      try {
        await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' })
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 })
        
        const links = await page.$$eval(`li.b_algo h2 a, a[href*="${domain}"]`, (anchors) => 
          anchors.map(a => (a as HTMLAnchorElement).href)
        )
        // Add top 3 links from this domain search
        allLinks = allLinks.concat(links.slice(0, 3))
        
        // Manual delay for anti-spam evasion
        await page.waitForTimeout(3000)
      } catch (err) {
        console.error(`[huntJobs] Error scraping Bing for ${domain}:`, err)
      }
    }
    
    await page.close().catch(() => {})

    // Filter to ensure they are target ATS domains and limit to top 5
    const jobLinks = Array.from(new Set(allLinks)) // Deduplicate
      .filter(href => atsDomains.some(domain => href.includes(domain)))
      .slice(0, 5)

    console.log(`[huntJobs] Found ${jobLinks.length} job links to process.`)

    for (const jobUrl of jobLinks) {
      try {
        console.log(`[huntJobs] Processing: ${jobUrl}`)
        const jobPage = await context.newPage()
        await jobPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {})
        
        // Extract description text from direct ATS page
        const text = await jobPage.$eval('body', el => (el as HTMLElement).innerText).catch(() => "")
        await jobPage.close()

        if (!text || text.length < 100) {
          console.log(`[huntJobs] Skipping ${jobUrl} - no readable content`)
          continue
        }

        // Analyze via Gemini
        const analysis = await analyzeJobText(text, candidateProfile, jobUrl)

        // Insert to Supabase
        const dbCol = analysis.matchScore > 75 ? 'review' : 'discovered'
        const jobRow = {
          user_id: userId,
          company: analysis.company,
          title: analysis.role,
          location: location,
          posted_ago: "Just now",
          match_score: analysis.matchScore,
          "column": dbCol,
          verdict: analysis.verdict,
          matches_found: analysis.matchesFound,
          missing_or_weak: analysis.missingOrWeak,
          human_input_required: analysis.humanInputRequired,
          source_url: jobUrl,
          needs_input: false,
        }

        const authHeader = req.headers.authorization
        let scopedSupabase = supabase
        if (authHeader) {
          scopedSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
            global: { headers: { Authorization: authHeader } }
          })
        }

        const { error } = await scopedSupabase.from('jobs').insert(jobRow)
        if (error) {
          console.error(`[huntJobs] DB Insert Error: ${error.message}`)
        } else {
          discoveredCount++
          console.log(`[huntJobs] Successfully persisted: ${analysis.role} at ${analysis.company}`)
        }
      } catch (jobErr) {
        console.error(`[huntJobs] Error processing job ${jobUrl}:`, jobErr)
      }
    }

    res.json({ success: true, count: discoveredCount })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[huntJobs] Execution failed:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  } finally {
    try { await browser.close() } catch {}
  }
}
