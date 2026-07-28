import { Request, Response } from "express"
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import { chromium, BrowserContext } from "playwright"
import { supabase } from "../supabaseClient.js"
import { createClient } from "@supabase/supabase-js"
import { fetchFromJSearch, fetchFromIndeed, fetchFromReed, fetchFromTheirstack } from "../utils/jobAdapter.js"

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
  userId?: string
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
  const browser = await chromium.launch({ headless: process.env.HEADLESS === 'false' ? false : true, slowMo: 100 })
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

export async function analyzeJobText(
  jobText: string,
  candidateProfile: CandidateProfile,
  url: string,
  memories: { memory_key: string; memory_value: string }[] = []
): Promise<JobAnalysisResult> {
  const truncated = jobText.slice(0, 8000)

  // Build memories context block
  const memoriesBlock = memories.length > 0
    ? `\n## Ghost Brain — Learned Facts\n${memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
    : ''

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
- Raw Resume Context: ${candidateProfile.rawResumeText.slice(0, 1000)}${memoriesBlock}

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

  console.log(`[analyzeJobText] Triggering Gemini AI Model (${process.env.GEMINI_MODEL || "gemini-flash-lite-latest"}). Prompt length: ${prompt.length} chars.`)
  
  const result = await model.generateContent(prompt)
  const rawText = result.response.text().trim()
  console.log(`[analyzeJobText] Gemini responded with ${rawText.length} characters.`)

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
    const { url, candidateProfile, userId } = req.body as AnalyzeJobPayload
    console.log(`\n===========================================`)
    console.log(`[analyzeJob] Request received.`)
    console.log(`[analyzeJob] User ID: ${userId || 'N/A'}`)
    console.log(`[analyzeJob] URL: ${url}`)
    console.log(`===========================================`)

    // Validate
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      res.status(400).json({ error: "Bad Request", message: "A valid http(s) URL is required." })
      return
    }
    if (!candidateProfile || !Array.isArray(candidateProfile.skills)) {
      res.status(400).json({ error: "Bad Request", message: "candidateProfile is missing required fields." })
      return
    }

    // Fetch candidate memories if userId provided
    let memories: { memory_key: string; memory_value: string }[] = []
    
    // Create an authenticated Supabase client for RLS
    const authHeader = req.headers.authorization
    let scopedSupabase = supabase
    if (authHeader) {
      scopedSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
        global: { headers: { Authorization: authHeader } }
      })
    }

    if (userId) {
      console.log(`[analyzeJob] Querying candidate_memories for user ${userId}...`)
      const { data: memData, error: memError } = await scopedSupabase
        .from('candidate_memories')
        .select('memory_key, memory_value')
        .eq('user_id', userId)
      
      if (memError) {
        console.error(`❌ [analyzeJob] Supabase memory fetch failed:`, memError)
      } else {
        memories = memData || []
        console.log(`✅ [analyzeJob] Supabase returned ${memories.length} memories.`)
      }
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

    const parsed = await analyzeJobText(jobDescription, candidateProfile, url, memories)
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
  const browser = await chromium.launch({ headless: process.env.HEADLESS === 'false' ? false : true, slowMo: 100 })
  try {
    const { jobUrl, candidateProfile } = req.body
    const jobMeta = req.body.jobMeta as { id?: string; title?: string; company?: string } | undefined
    const userId = req.body.userId as string | undefined

    console.log(`[applyJob] Request received. userId: ${userId}, jobId: ${jobMeta?.id}, jobUrl: ${jobUrl}`)

    // Extract token and create scoped Supabase client for RLS bypass
    const authHeader = req.headers.authorization
    if (!authHeader) {
      console.warn(`[applyJob] Missing Authorization header. RLS operations may fail.`)
    }
    let scopedSupabase = supabase
    if (authHeader) {
      scopedSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
        global: { headers: { Authorization: authHeader } }
      })
    }

    if (!jobUrl || typeof jobUrl !== "string") {
      await browser.close()
      console.warn(`[applyJob] Missing valid jobUrl. Aborting.`)
      res.status(400).json({ error: "Bad Request", message: "A valid jobUrl is required." })
      return
    }

    console.log(`[applyJob] Starting headless execution engine for: ${jobUrl}`)

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })
    const page = await context.newPage()

    // 1. Navigate to URL
    console.log(`[applyJob] Navigating to ${jobUrl}...`)
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
    console.log(`[applyJob] Scraping job page for document generation...`)
    const jdText = await scrapeJobPage(jobUrl)
    console.log(`[applyJob] Scraped ${jdText.length} characters from JD.`)

    // Fetch candidate memories for richer document context
    let docMemories: { memory_key: string; memory_value: string }[] = []
    
    // Declare buffer variables
    let resumePdfBuffer: Buffer | null = null
    let coverLetterPdfBuffer: Buffer | null = null

    if (userId) {
      const { data: memData } = await scopedSupabase
        .from('candidate_memories')
        .select('memory_key, memory_value')
        .eq('user_id', userId)
      docMemories = memData || []
    }
    const memoriesBlock = docMemories.length > 0
      ? `\n\nGhost Brain - Learned Facts:\n${docMemories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
      : ''

    const docGenPrompt = `
You are an expert resume and cover letter writer.

Candidate Profile: ${JSON.stringify(candidateProfile)}${memoriesBlock}
Original Cover Letter Style Reference: ${(candidateProfile.rawCoverLetterText || '').slice(0, 2000)}

Job Description: ${jdText.slice(0, 5000)}

Generate a highly tailored Resume and a Cover Letter for this specific job.
The cover letter MUST mirror the tone, voice, and structure of the Original Cover Letter Style Reference above.

Return a JSON object with FOUR keys:
1. "resumeHtml" - full A4-ready HTML for the resume
2. "coverLetterHtml" - full A4-ready HTML for the cover letter
3. "changes_made" - a 2-4 sentence plain English summary of the key changes made vs the original documents (which skills/experience were foregrounded, what was removed or deprioritised)
4. "reasoning" - a 2-3 sentence explanation of WHY these specific changes improve the candidate's chances for this particular role, referencing specific requirements from the JD and candidate skills that match them

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
              coverLetterHtml: { type: SchemaType.STRING },
              changes_made: { type: SchemaType.STRING },
              reasoning: { type: SchemaType.STRING }
            },
            required: ["resumeHtml", "coverLetterHtml", "changes_made", "reasoning"]
          } as any
        }
      })
      const docResult = await docModel.generateContent(docGenPrompt)
      const docs = JSON.parse(docResult.response.text().trim())
      
      const renderContext = await browser.newContext()
      const renderPage = await renderContext.newPage()
      
      await renderPage.setContent(docs.resumeHtml, { waitUntil: "networkidle" })
      resumePdfBuffer = await renderPage.pdf({ format: 'A4' })
      
      await renderPage.setContent(docs.coverLetterHtml, { waitUntil: "networkidle" })
      coverLetterPdfBuffer = await renderPage.pdf({ format: 'A4' })
      
      await renderContext.close()
      console.log(`[applyJob] Successfully generated bespoke PDF buffers.`)

      // Upload to Supabase Storage and store metadata in generated_docs
      if (userId && jobMeta?.id) {
        console.log(`[applyJob] Uploading buffers to Supabase Storage (Resume: ${resumePdfBuffer.length} bytes, CL: ${coverLetterPdfBuffer.length} bytes)...`)
        const resumePath = `${userId}/${jobMeta.id}-resume-${Date.now()}.pdf`
        const coverLetterPath = `${userId}/${jobMeta.id}-coverletter-${Date.now()}.pdf`
        
        const { error: resumeUploadError } = await scopedSupabase.storage.from('documents').upload(resumePath, resumePdfBuffer, { contentType: 'application/pdf', upsert: true })
        if (resumeUploadError) {
          console.error("❌ [applyJob] Resume Storage Upload Failed:", resumeUploadError)
          throw new Error(`Resume Storage Upload Failed: ${resumeUploadError.message}`)
        }
        const { data: { publicUrl: resumeUrl } } = scopedSupabase.storage.from('documents').getPublicUrl(resumePath)
        console.log("✅ [applyJob] Resume Storage Upload Success:", resumePath)

        const { error: clUploadError } = await scopedSupabase.storage.from('documents').upload(coverLetterPath, coverLetterPdfBuffer, { contentType: 'application/pdf', upsert: true })
        if (clUploadError) {
          console.error("❌ [applyJob] Cover Letter Storage Upload Failed:", clUploadError)
          throw new Error(`Cover Letter Storage Upload Failed: ${clUploadError.message}`)
        }
        const { data: { publicUrl: coverLetterUrl } } = scopedSupabase.storage.from('documents').getPublicUrl(coverLetterPath)
        console.log("✅ [applyJob] Cover Letter Storage Upload Success:", coverLetterPath)

        console.log(`[applyJob] Inserting metadata into generated_docs table...`)
        const docsToInsert = [
          {
            user_id: userId,
            job_title: jobMeta?.title || 'Unknown Role',
            company: jobMeta?.company || 'Unknown Company',
            doc_type: 'resume',
            file_path: resumeUrl,
            changes_made: docs.changes_made || null,
            reasoning: docs.reasoning || null
          },
          {
            user_id: userId,
            job_title: jobMeta?.title || 'Unknown Role',
            company: jobMeta?.company || 'Unknown Company',
            doc_type: 'cover_letter',
            file_path: coverLetterUrl,
            changes_made: docs.changes_made || null,
            reasoning: docs.reasoning || null
          }
        ]
        const { error: dbError } = await scopedSupabase.from('generated_docs').insert(docsToInsert)
        if (dbError) {
          console.error("❌ [applyJob] generated_docs insert failed:", dbError)
          throw new Error(`Database insert failed: ${dbError.message}`)
        } else {
          console.log(`✅ [applyJob] Inserted records into generated_docs.`)
        }
      }
    } catch (e) {
      console.error(`❌ [applyJob] Failed to generate/store documents:`, (e as Error).message)
      await browser.close()
      res.status(500).json({ error: "Document Generation Failed", message: (e as Error).message })
      return
    }

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
    console.warn(`[huntJobs] Missing parameters. searchRole: ${!!searchRole}, location: ${!!location}, candidateProfile: ${!!candidateProfile}, userId: ${!!userId}`)
    res.status(400).json({ error: "Missing parameters" })
    return
  }

  console.log(`\n===========================================`)
  console.log(`[huntJobs] Request received.`)
  console.log(`[huntJobs] Search Role: '${searchRole}'`)
  console.log(`[huntJobs] Location: '${location}'`)
  console.log(`[huntJobs] User ID: ${userId}`)
  console.log(`===========================================`)

  try {
    const authHeader = req.headers.authorization
    let scopedSupabase = supabase
    if (authHeader) {
      scopedSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
        global: { headers: { Authorization: authHeader } }
      })
    }

    // Step 1: Build the Exclusion List
    console.log(`[huntJobs] Querying Supabase 'jobs' table for user's tracked jobs...`)
    const { data: existingJobs, error: existingError } = await scopedSupabase
      .from('jobs')
      .select('source_url')
      .eq('user_id', userId)

    if (existingError) {
      console.error(`❌ [huntJobs] Failed to fetch user's tracked jobs:`, existingError)
      throw new Error(`Failed to fetch user's tracked jobs: ${existingError.message}`)
    }
    console.log(`✅ [huntJobs] Found ${existingJobs?.length || 0} tracked jobs for user ${userId}.`)

    const trackedUrls = new Set(existingJobs?.map(j => j.source_url) || [])

    // Step 2: Check the Data Lake (Fuzzy Search)
    console.log(`[huntJobs] Querying Data Lake for '${searchRole}' in '${location}'...`)
    const { data: candidateGlobalJobs, error: globalError } = await scopedSupabase
      .from('global_jobs')
      .select('*')
      .ilike('title', `%${searchRole}%`)
      .ilike('location', `%${location}%`)
      .limit(50)

    if (globalError) {
      console.warn(`[huntJobs] Data Lake query error:`, globalError.message)
    }

    let unEvaluatedJobs = (candidateGlobalJobs || []).filter(job => !trackedUrls.has(job.apply_url))
    console.log(`[huntJobs] Data Lake returned ${unEvaluatedJobs.length} un-evaluated jobs.`)

    // Step 3: Trigger External APIs (If < 5 jobs found)
    if (unEvaluatedJobs.length < 5) {
      console.log(`[huntJobs] Insufficient jobs in Data Lake. Triggering API Fallback Engine...`)
      
      let jobs = await fetchFromJSearch(searchRole, location)
      console.log(`[huntJobs] Fetched ${jobs.length} jobs from JSearch.`)

      if (jobs.length === 0) {
        console.log(`[huntJobs] JSearch failed or returned 0. Falling back to Indeed...`)
        jobs = await fetchFromIndeed(searchRole, location)
        console.log(`[huntJobs] Fetched ${jobs.length} jobs from Indeed.`)
      }

      if (jobs.length === 0) {
        console.log(`[huntJobs] Indeed failed or returned 0. Falling back to Reed...`)
        jobs = await fetchFromReed(searchRole, location)
        console.log(`[huntJobs] Fetched ${jobs.length} jobs from Reed.`)
      }

      if (jobs.length === 0) {
        console.log(`[huntJobs] Reed failed or returned 0. Falling back to TheirStack...`)
        jobs = await fetchFromTheirstack(searchRole, location)
        console.log(`[huntJobs] Fetched ${jobs.length} jobs from TheirStack.`)
      }

      if (jobs.length > 0) {
        // Bulk upsert new jobs into global_jobs
        const { data, error } = await scopedSupabase
          .from('global_jobs')
          .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })
          .select()

        if (error) {
          console.error(`[huntJobs] Bulk insert error:`, error.message)
        } else {
          console.log(`[huntJobs] Successfully inserted ${data?.length || 0} new jobs into global_jobs.`)
        }

        // Filter new API results against the Exclusion List
        const newUnEvaluated = jobs.filter(job => !trackedUrls.has(job.apply_url))
        
        // Combine with Data Lake jobs
        unEvaluatedJobs = [...unEvaluatedJobs, ...newUnEvaluated]
      }
    }

    // Step 4: Take the top 5 jobs
    unEvaluatedJobs = unEvaluatedJobs.slice(0, 5)
    console.log(`[huntJobs] Proceeding to Gemini Evaluation with ${unEvaluatedJobs.length} jobs.`)

    // Fetch candidate memories once to inject into all scoring calls
    let huntMemories: { memory_key: string; memory_value: string }[] = []
    const { data: memData } = await scopedSupabase
      .from('candidate_memories')
      .select('memory_key, memory_value')
      .eq('user_id', userId)
    huntMemories = memData || []
    console.log(`[huntJobs] Injecting ${huntMemories.length} candidate memories into scoring prompts.`)

    // Step 5: Evaluate with Gemini & Insert into Kanban
    const evaluatedJobs = []
    for (const job of unEvaluatedJobs) {
      console.log(`[huntJobs] Evaluating: ${job.title} at ${job.company}`)
      try {
        const parsed = await analyzeJobText(job.description, candidateProfile, job.apply_url, huntMemories)
        
        const kanbanJob = {
          user_id: userId,
          company: parsed.company || job.company,
          title: parsed.role || job.title,
          location: job.location,
          source_url: job.apply_url,
          match_score: parsed.matchScore,
          verdict: parsed.verdict,
          matches_found: parsed.matchesFound,
          missing_or_weak: parsed.missingOrWeak,
          human_input_required: parsed.humanInputRequired,
          column: 'discovered'
        }

        const { data: insertedJob, error: insertError } = await scopedSupabase
          .from('jobs')
          .insert(kanbanJob)
          .select()
          .single()

        if (insertError) {
          console.error(`❌ [huntJobs] Failed to insert job into Kanban:`, insertError)
        } else if (insertedJob) {
          console.log(`✅ [huntJobs] Inserted evaluated job into Kanban: ${insertedJob.title} at ${insertedJob.company}`)
          evaluatedJobs.push(insertedJob)
        }
      } catch (e) {
        console.error(`❌ [huntJobs] Failed to evaluate job ${job.apply_url}:`, e)
      }
    }

    res.json({ success: true, count: evaluatedJobs.length, jobs: evaluatedJobs })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[huntJobs] Execution failed:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  }
}
