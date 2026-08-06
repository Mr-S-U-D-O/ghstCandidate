import { Request, Response } from "express"
import OpenAI from "openai"
import { chromium } from "playwright"
import { supabase } from "../supabaseClient.js"
import { createClient } from "@supabase/supabase-js"
import { ingestFeeds } from "../utils/cron/harvester.js"
import { extractJobFromUrl } from "../utils/jsonLdExtractor.js"
import { generateCompletion } from "../utils/ai.js"

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

// ── JSON Sanitization Helper ──────────────────────────────────────

function cleanAndParseJSON(rawText: string) {
  let text = rawText.trim();
  // Strip markdown code fences
  text = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

  // Strip double-wrapped HTML payload anomalies
  if (text.match(/^\{\s*"\{/)) {
    text = text.replace(/^\{\s*"/, '');
    text = text.replace(/"\s*\}$/, '');
  }

  // Isolate content between first '{' and last '}'
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.substring(start, end + 1);
  }

  // Repair leading key stutters like `{"key{"key":` -> `{"key":`
  text = text.replace(/^\{\s*"[a-zA-Z0-9_]+\{\s*"/, '{"');

  try {
    return JSON.parse(text);
  } catch (e) {
    // Secondary attempt for wrapped stringified JSON
    if (text.startsWith('"') && text.endsWith('"')) {
      const inner = JSON.parse(text);
      if (typeof inner === 'string') return JSON.parse(inner);
    }
    throw e;
  }
}

// ── LLM Response Schema ─────────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    company:  { type: "string", description: "Company name extracted from the job description" },
    role:     { type: "string", description: "Job title extracted from the job description" },
    matchScore: { type: "number", description: "Integer 0-100: how well the candidate matches this role" },
    verdict:  { type: "string", description: "2-3 sentence honest summary. Reference specific skills or requirements from the JD." },
    matchesFound: {
      type: "array",
      items: { type: "string" },
      description: "3-5 specific skills/experiences from the candidate profile that match the JD requirements"
    },
    missingOrWeak: {
      type: "array",
      items: { type: "string" },
      description: "1-3 honest skill gaps relative to the JD. Empty array if none."
    },
    humanInputRequired: {
      type: "array",
      items: { type: "string" },
      description: "Fields the Ghost cannot auto-fill: salary, visa, portfolio, cover letter. Empty array if none."
    }
  },
  required: ["company", "role", "matchScore", "verdict", "matchesFound", "missingOrWeak", "humanInputRequired"]
}

// ── Playwright Tier-4 Fallback Scraper ────────────────────────────────────────
// ONLY used by the /api/analyze-job endpoint when all 3 JSON-LD tiers fail.
// NEVER called by huntJobs or the background harvester.

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

CRITICAL REQUIREMENT: You MUST respond ONLY with a single valid JSON object. Do not include markdown formatting, thought preambles, or unclosed syntax.
${JSON.stringify(RESPONSE_SCHEMA, null, 2)}
`.trim()

  // Step 3: Call AI Provider via robust wrapper
  console.log(`[analyzeJobText] Triggering AI Provider. Prompt length: ${prompt.length} chars.`)
  
  let rawText = ""
  try {
    rawText = await generateCompletion({
      prompt: prompt,
      maxTokens: 4000,
      jsonMode: true
    })
  } catch (err: any) {
    console.warn(`[analyzeJobText] ❌ AI provider failed after fallbacks: ${err.message}. Returning graceful fallback.`);
    return {
      company: "Unknown (AI Overloaded)",
      role: "Unknown",
      matchScore: 0,
      verdict: "The AI provider is currently overloaded and could not analyze this job.",
      matchesFound: [],
      missingOrWeak: [],
      humanInputRequired: []
    }
  }

  console.log(`[analyzeJobText] AI responded with ${rawText.length} characters.`)

  // Parse with stutter repair and double-encoding protection
  let parsed: JobAnalysisResult
  try {
    parsed = cleanAndParseJSON(rawText) as JobAnalysisResult;
  } catch (error) {
    console.log("[analyzeJobText] ❌ DeepSeek API or Parse Error:", error);
    return {
      company: "Unknown Company",
      role: "Unknown Role",
      matchScore: 0,
      verdict: "The AI provider returned a truncated or invalid response due to server load. Please click 'Retry Analysis' to try again.",
      matchesFound: [],
      missingOrWeak: [],
      humanInputRequired: []
    };
  }

  // Clamp score
  parsed.matchScore = Math.max(0, Math.min(100, Math.round(parsed.matchScore || 0)))
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

    // Step 1: Extract job description — 3-tier JSON-LD waterfall → Tier-4 Playwright fallback
    console.log(`[analyzeJob] Extracting job data (JSON-LD → OpenGraph → BodyText → Playwright): ${url}`)
    let jobDescription: string
    try {
      const extracted = await extractJobFromUrl(url)
      jobDescription = extracted.description_html || ''

      // Tier-4 Playwright fallback: only fires if all 3 zero-browser tiers returned insufficient content
      if (!jobDescription || jobDescription.length < 100) {
        console.warn(`[analyzeJob] ⚠️ JSON-LD tiers returned insufficient content. Falling back to Tier-4 Playwright...`)
        jobDescription = await scrapeJobPagePlaywright(url)
      }
    } catch (scrapeErr) {
      const msg = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)
      console.error("[analyzeJob] Extraction failed:", msg)
      res.status(422).json({ error: "Extraction Failed", message: `Could not extract job content from the URL. ${msg}` })
      return
    }

    if (!jobDescription || jobDescription.length < 100) {
      res.status(422).json({ error: "Extraction Empty", message: "The page loaded but contained no readable job content after all extraction tiers." })
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

// ── Shared Doc Gen Helper ──────────────────────────────────────────

export interface BespokeDocsResult {
  resumePdfBuffer: Buffer
  coverLetterPdfBuffer: Buffer
  resumeUrl: string
  coverLetterUrl: string
  changes_made: string | null
  reasoning: string | null
}

export interface BespokeDocsOptions {
  jdText: string
  candidateProfile: CandidateProfile
  memories: { memory_key: string; memory_value: string }[]
  userId: string
  jobId: string
  jobTitle?: string
  company?: string
  scopedSupabase: any
}

export async function generateBespokeDocs(opts: BespokeDocsOptions): Promise<BespokeDocsResult> {
  const { jdText, candidateProfile, memories, userId, jobId, jobTitle, company, scopedSupabase } = opts

  console.log(`[generateBespokeDocs] Starting for job: "${jobTitle}" at "${company}"`)
  console.log(`[generateBespokeDocs] JD length: ${jdText.length} chars | Memories: ${memories.length}`)

  const memoriesBlock = memories.length > 0
    ? `\n\nGhost Brain - Learned Facts:\n${memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
    : ''

  const docGenPrompt = `
You are an expert resume and cover letter writer.

Candidate Profile: ${JSON.stringify(candidateProfile)}${memoriesBlock}
Original Cover Letter Style Reference: ${(candidateProfile.rawCoverLetterText || '').slice(0, 2000)}

Job Description: ${jdText.slice(0, 5000)}

Generate a highly tailored Resume and a Cover Letter for this specific job.
The cover letter MUST mirror the tone, voice, and structure of the Original Cover Letter Style Reference above. Keep the cover letter concise, exactly 3 paragraphs.

Return a JSON object with FOUR keys:
1. "resumeHtml" - full A4-ready HTML for the resume
2. "coverLetterHtml" - full A4-ready HTML for the cover letter
3. "changes_made" - a brief 2 sentence summary of key changes made
4. "reasoning" - a brief 2 sentence explanation of WHY these changes improve chances

STRICT STYLING REQUIREMENTS FOR HTML:
- Minimalist, achromatic color palette (black, white, grays).
- Whitespace dominant (high padding/margins).
- Headings MUST use 'Comfortaa' font via Google Fonts (<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&display=swap" rel="stylesheet">).
- Body text MUST use 'Lato' font via Google Fonts (<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">).
- Use inline styles or a <style> block.

CRITICAL REQUIREMENT: Return ONLY valid JSON. Do not include markdown formatting.
`.trim()

  console.log(`[generateBespokeDocs] Calling AI Provider...`)
  let rawDocText = "{}"
  try {
    rawDocText = await generateCompletion({
      prompt: docGenPrompt,
      maxTokens: 4000,
      jsonMode: true
    })
  } catch (err: any) {
    console.warn(`[generateBespokeDocs] ❌ Upstream AI provider overloaded or failed after 3 attempts. Throwing AI_PROVIDER_OVERLOADED. Error: ${err.message}`);
    throw new Error("AI_PROVIDER_OVERLOADED");
  }
  
  // Parse with stutter repair and double-encoding protection
  let docs;
  try {
    docs = cleanAndParseJSON(rawDocText);
  } catch (e) {
    console.error(`[generateBespokeDocs] ❌ DeepSeek parse error:`, rawDocText)
    docs = {
      resumeHtml: "<html><body style='font-family:Lato; padding:40px'><h1>Resume Generation Failed</h1><p>Please review raw output.</p></body></html>",
      coverLetterHtml: "<html><body style='font-family:Lato; padding:40px'><h1>Cover Letter Generation Failed</h1><p>Please review raw output.</p></body></html>",
      changes_made: "Fallback mode activated due to AI parse error.",
      reasoning: "DeepSeek failed to format response correctly."
    }
  }

  console.log(`[generateBespokeDocs] ✅ NVIDIA responded. Rendering PDFs...`)

  // Render HTML to PDFs using Playwright
  const browser = await chromium.launch({ headless: true })
  let resumePdfBuffer: Buffer
  let coverLetterPdfBuffer: Buffer

  const safeResumeHtml = docs.resumeHtml 
    || docs.resume_html 
    || docs.resume 
    || "<html><body><h1>Resume Error</h1><p>The AI failed to generate the resume HTML.</p></body></html>";

  const safeCoverLetterHtml = docs.coverLetterHtml 
    || docs.cover_letter_html 
    || docs.coverLetter 
    || "<html><body><h1>Cover Letter Error</h1><p>The AI failed to generate the cover letter HTML.</p></body></html>";

  try {
    const renderContext = await browser.newContext()
    const renderPage = await renderContext.newPage()

    await renderPage.setContent(safeResumeHtml, { waitUntil: "networkidle" })
    resumePdfBuffer = await renderPage.pdf({ format: 'A4' })

    await renderPage.setContent(safeCoverLetterHtml, { waitUntil: "networkidle" })
    coverLetterPdfBuffer = await renderPage.pdf({ format: 'A4' })

    await renderContext.close()
  } finally {
    await browser.close()
  }

  console.log(`[generateBespokeDocs] PDFs rendered — Resume: ${resumePdfBuffer.length} bytes | CL: ${coverLetterPdfBuffer.length} bytes`)

  // Upload to Supabase Storage
  const ts = Date.now()
  const resumePath = `${userId}/${jobId}-resume-${ts}.pdf`
  const clPath = `${userId}/${jobId}-coverletter-${ts}.pdf`

  const { error: resumeUploadError } = await scopedSupabase.storage.from('documents').upload(resumePath, resumePdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (resumeUploadError) {
    console.error(`❌ [generateBespokeDocs] Resume upload failed:`, resumeUploadError)
    throw new Error(`Resume Storage Upload Failed: ${resumeUploadError.message}`)
  }
  const { data: { publicUrl: resumeUrl } } = scopedSupabase.storage.from('documents').getPublicUrl(resumePath)
  console.log(`✅ [generateBespokeDocs] Resume uploaded:`, resumePath)

  const { error: clUploadError } = await scopedSupabase.storage.from('documents').upload(clPath, coverLetterPdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (clUploadError) {
    console.error(`❌ [generateBespokeDocs] Cover letter upload failed:`, clUploadError)
    throw new Error(`Cover Letter Storage Upload Failed: ${clUploadError.message}`)
  }
  const { data: { publicUrl: coverLetterUrl } } = scopedSupabase.storage.from('documents').getPublicUrl(clPath)
  console.log(`✅ [generateBespokeDocs] Cover letter uploaded:`, clPath)

  // Insert metadata into generated_docs
  const docsToInsert = [
    { user_id: userId, job_id: jobId, job_title: jobTitle || 'Unknown Role', company: company || 'Unknown Company', doc_type: 'resume', file_path: resumeUrl, changes_made: docs.changes_made || null, reasoning: docs.reasoning || null },
    { user_id: userId, job_id: jobId, job_title: jobTitle || 'Unknown Role', company: company || 'Unknown Company', doc_type: 'cover_letter', file_path: coverLetterUrl, changes_made: docs.changes_made || null, reasoning: docs.reasoning || null }
  ]
  const { error: dbError } = await (scopedSupabase as any).from('generated_docs').insert(docsToInsert)
  if (dbError) {
    console.error(`❌ [generateBespokeDocs] DB insert failed:`, dbError)
    throw new Error(`Database insert failed: ${dbError.message}`)
  }
  console.log(`✅ [generateBespokeDocs] Metadata inserted into generated_docs.`)

  return { resumePdfBuffer, coverLetterPdfBuffer, resumeUrl, coverLetterUrl, changes_made: docs.changes_made || null, reasoning: docs.reasoning || null }
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

    // 2. Blocker Detection
    const hasPassword = await page.$('input[type="password"]')
    const iframes = await page.$$eval('iframe', frames => frames.map(f => f.src.toLowerCase()))
    const hasCaptcha = iframes.some(src => src.includes('captcha') || src.includes('turnstile') || src.includes('challenge'))

    if (hasPassword || hasCaptcha) {
      console.warn(`[applyJob] Blocker detected (Password: ${!!hasPassword}, Captcha: ${hasCaptcha}). Aborting.`)
      await browser.close()
      res.status(400).json({
        success: false,
        status: "NEEDS_INPUT",
        missingField: hasPassword ? "Login required — manual sign-in needed" : "CAPTCHA / challenge detected"
      })
      return
    }

    // 3. Fetch memories
    let docMemories: { memory_key: string; memory_value: string }[] = []
    if (userId) {
      const { data: memData } = await scopedSupabase
        .from('candidate_memories')
        .select('memory_key, memory_value')
        .eq('user_id', userId)
      docMemories = memData || []
      console.log(`[applyJob] Fetched ${docMemories.length} memories.`)
    }

    // 4. Generate Bespoke Documents via shared helper
    // Use zero-browser JSON-LD extractor for JD text (Playwright browser here is for PDF rendering only)
    try {
      const extracted = await extractJobFromUrl(jobUrl)
      const jdText = extracted.description_html || ''
      console.log(`[applyJob] Extracted ${jdText.length} characters from JD (tier: ${extracted.extractionTier ?? 'unknown'}).`)

      if (userId && jobMeta?.id) {
        await generateBespokeDocs({
          jdText: jdText || `Job posting at: ${jobUrl}`,
          candidateProfile,
          memories: docMemories,
          userId,
          jobId: jobMeta.id,
          jobTitle: jobMeta.title,
          company: jobMeta.company,
          scopedSupabase
        })
      }
    } catch (e) {
      console.error(`❌ [applyJob] Document generation failed:`, (e as Error).message)
      await browser.close()
      res.status(500).json({ error: "Document Generation Failed", message: (e as Error).message })
      return
    }

    console.log(`[applyJob] Execution complete. Browser closed.`)

    res.status(200).json({
      success: true,
      message: "The Ghost has successfully generated your documents."
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

    // Step 2: Tokenize the Wide Net Queries
    const roleTokens = searchRole.split(/[\s,]+/).filter((t: string) => t.length > 2)
    if (roleTokens.length === 0) roleTokens.push(searchRole)
    const titleOrQuery = roleTokens.map((token: string) => `title.ilike."%${token.replace(/"/g, '')}%"`).join(',')
    
    // Extract just the city to make the Wide Net better and avoid comma syntax errors
    const baseLocation = location.split(',')[0].trim().replace(/"/g, '')
    const locationOrQuery = `location.ilike."%${baseLocation}%",location.ilike."%remote%",location.ilike."%anywhere%",location.ilike."%worldwide%"`

    console.log(`[huntJobs] Querying Data Lake with Wide Net strategy...`)
    const { data: candidateGlobalJobs, error: globalError } = await scopedSupabase
      .from('global_jobs')
      .select('*')
      .or(titleOrQuery)
      .or(locationOrQuery)
      .limit(50)

    if (globalError) {
      console.warn(`[huntJobs] Data Lake query error:`, globalError.message)
    }

    let unEvaluatedJobs = (candidateGlobalJobs || []).filter(job => !trackedUrls.has(job.apply_url))
    console.log(`[huntJobs] Data Lake returned ${unEvaluatedJobs.length} un-evaluated jobs.`)

    // Data Lake is the sole source of truth (populated by background harvester)
    if (unEvaluatedJobs.length === 0) {
      console.log(`[huntJobs] ⚠️ Data Lake empty for criteria. Triggering live on-demand feed ingestion...`)
      const freshJobs = await ingestFeeds();
      const mappedGlobalJobs = freshJobs.map(j => ({
        title: j.title,
        company: j.company,
        location: j.location,
        description: j.description_html,
        apply_url: j.apply_url,
        api_source: j.source
      }))
      
      // Upsert into Data Lake
      const { error: upsertError } = await supabase
        .from('global_jobs')
        .upsert(mappedGlobalJobs, { onConflict: 'apply_url', ignoreDuplicates: true });
        
      if (upsertError) {
        console.error(`❌ [huntJobs] Fallback upsert failed:`, upsertError.message)
      }
        
      // Re-run the query against global_jobs
      const { data: retryCandidateGlobalJobs } = await scopedSupabase
        .from('global_jobs')
        .select('*')
        .or(titleOrQuery)
        .or(locationOrQuery)
        .limit(50)
      
      unEvaluatedJobs = (retryCandidateGlobalJobs || []).filter(job => !trackedUrls.has(job.apply_url))
      console.log(`[huntJobs] Data Lake (Live Fallback) returned ${unEvaluatedJobs.length} un-evaluated jobs.`)
    }

    console.log(`[huntJobs] Proceeding to evaluate ${unEvaluatedJobs.length} jobs with Wide Net strategy.`)

    // Step 5: Pre-Evaluation Engine — Concurrency-Capped Parallel LLM Evaluation
    // Uses Promise.allSettled with a sliding window of 5 concurrent tasks to prevent
    // serial LLM bottlenecking (50 sequential calls was previously 5-10 min of wall time).
    const evaluatedJobs: any[] = []
    const CONCURRENCY = 5

    async function evaluateAndQueue(job: any): Promise<void> {
      console.log(`[huntJobs] Pre-evaluating: ${job.title} at ${job.company}`)
      const jobDesc = job.description || job.description_html || ''
      const parsed = await analyzeJobText(jobDesc, candidateProfile, job.apply_url, [])

      if (parsed.matchScore < 40) {
        console.log(`[huntJobs] Skipped (Score ${parsed.matchScore} < 40): ${job.title} at ${job.company}`)
        return
      }

      const kanbanJob = {
        user_id: userId,
        company: parsed.company || job.company || 'Unknown Company',
        title: parsed.role || job.title,
        location: job.location,
        source_url: job.apply_url,
        match_score: parsed.matchScore,
        verdict: parsed.verdict,
        matches_found: parsed.matchesFound,
        missing_or_weak: parsed.missingOrWeak,
        human_input_required: parsed.humanInputRequired,
        column: 'discovered',
        needs_input: false
      }

      const { data: insertedJob, error: insertError } = await scopedSupabase
        .from('jobs')
        .insert(kanbanJob)
        .select()
        .single()

      if (insertError) {
        console.error(`❌ [huntJobs] Failed to insert job into Kanban:`, insertError)
      } else if (insertedJob) {
        console.log(`✅ [huntJobs] Queued: "${insertedJob.title}" at "${insertedJob.company}" (Score: ${parsed.matchScore})`)
        evaluatedJobs.push(insertedJob)
      }
    }

    // Process in sliding windows of CONCURRENCY
    for (let i = 0; i < unEvaluatedJobs.length; i += CONCURRENCY) {
      const batch = unEvaluatedJobs.slice(i, i + CONCURRENCY)
      console.log(`[huntJobs] Evaluating batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(unEvaluatedJobs.length / CONCURRENCY)} (${batch.length} jobs)...`)
      const results = await Promise.allSettled(batch.map(job => evaluateAndQueue(job)))
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error(`❌ [huntJobs] Batch evaluation failed for job at index ${i + idx}:`, r.reason)
        }
      })
    }

    res.json({ success: true, count: evaluatedJobs.length, jobs: evaluatedJobs })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[huntJobs] Execution failed:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  }
}

// ── Seed Harvester (One-Shot Data Lake Population) ──────────────────

// ── Manual Admin Trigger ────────────────────────────────────────────────────
// Refactored from Apify-based seedHarvester to directly call the new
// modular ingestFeeds() from the skill provider stack.
// Use via Postman / admin UI to force a Global Harvester run on demand.

export async function seedHarvester(req: Request, res: Response): Promise<void> {
  console.log(`\n===========================================`)
  console.log(`[seedHarvester] Manual admin trigger: forcing Global Harvester run...`)
  console.log(`===========================================`)

  try {
    const freshJobs = await ingestFeeds()
    console.log(`[seedHarvester] Ingested ${freshJobs.length} jobs. Upserting into global_jobs...`)

    if (freshJobs.length === 0) {
      res.json({ success: true, message: 'Harvest returned 0 jobs. Check provider connectivity.', inserted: 0 })
      return
    }

    const mappedGlobalJobs = freshJobs.map(j => ({
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description_html,
      apply_url: j.apply_url,
      api_source: j.source
    }))

    const { data, error } = await supabase
      .from('global_jobs')
      .upsert(mappedGlobalJobs, { onConflict: 'apply_url', ignoreDuplicates: true })
      .select()

    if (error) {
      console.error(`[seedHarvester] ❌ Upsert error:`, error.message)
      res.status(500).json({ error: 'Upsert Failed', message: error.message })
      return
    }

    const bySource = freshJobs.reduce((acc: Record<string, number>, j) => {
      acc[j.source] = (acc[j.source] || 0) + 1
      return acc
    }, {})

    console.log(`[seedHarvester] ✅ Seeded ${data?.length || 0} new jobs into global_jobs.`)
    res.json({
      success: true,
      harvested: freshJobs.length,
      inserted: data?.length || 0,
      bySource
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[seedHarvester] ❌ Unhandled error:`, message)
    res.status(500).json({ error: 'Internal Server Error', message })
  }
}

// ── Reject Job & Cascading Delete ─────────────────────────────────

export async function deleteJob(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  try {
    // 1. Check generated_docs for associated documents
    const { data: docs } = await supabase
      .from('generated_docs')
      .select('resume_url, cover_letter_url')
      .eq('job_id', id)
      .single()

    // 2. Delete files from Supabase Storage if they exist
    if (docs) {
      const pathsToDelete: string[] = []
      const extractPath = (url: string | null) => {
        if (!url) return null
        // URL format: https://.../storage/v1/object/public/documents/[user_id]/[file_name]
        const match = url.match(/\/documents\/(.+)$/)
        return match ? match[1] : null
      }

      const resumePath = extractPath(docs.resume_url)
      const coverLetterPath = extractPath(docs.cover_letter_url)

      if (resumePath) pathsToDelete.push(resumePath)
      if (coverLetterPath) pathsToDelete.push(coverLetterPath)

      if (pathsToDelete.length > 0) {
        console.log(`[deleteJob] Deleting ${pathsToDelete.length} files from storage for job ${id}...`)
        const { error: storageError } = await supabase.storage.from('documents').remove(pathsToDelete)
        if (storageError) {
          console.error('[deleteJob] ❌ Failed to delete storage files:', storageError.message)
          // Continue with DB row deletion anyway
        }
      }
    }

    // 3. Delete from jobs (cascades to generated_docs)
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[deleteJob] ❌ Database delete error:', deleteError.message)
      res.status(500).json({ error: 'Database Delete Failed', message: deleteError.message })
      return
    }

    console.log(`[deleteJob] ✅ Job ${id} and associated assets successfully deleted.`)
    res.status(200).json({ success: true, message: 'Job deleted successfully' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[deleteJob] ❌ Unhandled error:`, message)
    res.status(500).json({ error: 'Internal Server Error', message })
  }
}
