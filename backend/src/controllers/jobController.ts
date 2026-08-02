import { Request, Response } from "express"
import OpenAI from "openai"
import { chromium, BrowserContext } from "playwright"
import { supabase } from "../supabaseClient.js"
import { createClient } from "@supabase/supabase-js"
import { harvestAllSources } from "../utils/jobAdapter.js"

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

// ── NVIDIA Client (lazy singleton) ────────────────────────────────

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.NVIDIA_API_KEY
    if (!key) throw new Error("NVIDIA_API_KEY is not set in environment variables.")
    _openai = new OpenAI({
      apiKey: key,
      baseURL: "https://integrate.api.nvidia.com/v1"
    })
  }
  return _openai
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

CRITICAL REQUIREMENT: You MUST respond ONLY with a single valid JSON object. Do not include markdown formatting, thought preambles, or unclosed syntax.
${JSON.stringify(RESPONSE_SCHEMA, null, 2)}
`.trim()

  // Step 3: Call OpenAI (NVIDIA DeepSeek)
  const openai = getOpenAI()

  console.log(`[analyzeJobText] Triggering NVIDIA DeepSeek V4 Model. Prompt length: ${prompt.length} chars.`)
  
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "deepseek-ai/deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 16384,
      // @ts-ignore - NVIDIA specific kwarg for DeepSeek reasoning
      chat_template_kwargs: { "thinking": true, "reasoning_effort": "high" },
      response_format: { type: "json_object" }
    })
  } catch (err: any) {
    if (err.status === 529 || err.status === 429) {
      console.warn(`[analyzeJobText] Upstream AI provider overloaded (${err.status}). Returning graceful fallback.`);
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
    throw err;
  }

  const msg = completion.choices[0]?.message as any
  if (msg?.reasoning_content) {
    console.log(`[analyzeJobText] DeepSeek Reasoning: ${msg.reasoning_content.slice(0, 150).replace(/\\n/g, ' ')}...`)
  }

  let rawText = (msg?.content || "").trim()
  console.log(`[analyzeJobText] NVIDIA responded with ${rawText.length} characters.`)

  // 1. Remove markdown code blocks if present
  rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

  // 2. Strip accidental outer quotes if wrapped like "{ ... }"
  if (rawText.startsWith('"') && rawText.endsWith('"')) {
    rawText = rawText.slice(1, -1).trim();
    rawText = rawText.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  // 3. Extract strictly between the first '{' and last '}'
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    rawText = rawText.substring(firstBrace, lastBrace + 1);
  }

  // 4. Safely parse with double-encoding protection
  let parsed: JobAnalysisResult
  try {
    let parsedData = JSON.parse(rawText);
    if (typeof parsedData === 'string') {
      parsedData = JSON.parse(parsedData);
    }
    parsed = parsedData as JobAnalysisResult;
  } catch (e) {
    console.error(`[analyzeJobText] ❌ DeepSeek parse error:`, rawText)
    return {
      company: "Unknown",
      role: "Unknown",
      matchScore: 0,
      verdict: "The AI provider failed to format the analysis properly.",
      matchesFound: [],
      missingOrWeak: [],
      humanInputRequired: []
    }
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

CRITICAL REQUIREMENT: You MUST respond ONLY with a single valid JSON object. Do not include markdown formatting, thought preambles, or unclosed syntax.
`.trim()

  const openai = getOpenAI()

  console.log(`[generateBespokeDocs] Calling NVIDIA DeepSeek model...`)
  let docCompletion;
  try {
    docCompletion = await openai.chat.completions.create({
      model: "deepseek-ai/deepseek-v4-flash",
      messages: [{ role: "user", content: docGenPrompt }],
      max_tokens: 16384,
      // @ts-ignore
      chat_template_kwargs: { "thinking": true, "reasoning_effort": "high" },
      response_format: { type: "json_object" }
    })
  } catch (err: any) {
    if (err.status === 529 || err.status === 429) {
      console.warn(`[generateBespokeDocs] Upstream AI provider overloaded (${err.status}). Throwing AI_PROVIDER_OVERLOADED.`);
      throw new Error("AI_PROVIDER_OVERLOADED");
    }
    throw err;
  }

  const docMsg = docCompletion.choices[0]?.message as any
  if (docMsg?.reasoning_content) {
    console.log(`[generateBespokeDocs] DeepSeek Reasoning: ${docMsg.reasoning_content.slice(0, 150).replace(/\\n/g, ' ')}...`)
  }

  let rawDocText = (docMsg?.content || "{}").trim()
  
  // 1. Remove markdown code blocks if present
  rawDocText = rawDocText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

  // 2. Strip accidental outer quotes if wrapped like "{ ... }"
  if (rawDocText.startsWith('"') && rawDocText.endsWith('"')) {
    rawDocText = rawDocText.slice(1, -1).trim();
    rawDocText = rawDocText.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  // 3. Extract strictly between the first '{' and last '}'
  const firstBrace = rawDocText.indexOf('{');
  const lastBrace = rawDocText.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    rawDocText = rawDocText.substring(firstBrace, lastBrace + 1);
  }

  // 4. Safely parse with double-encoding protection
  let docs;
  try {
    let parsedData = JSON.parse(rawDocText);
    if (typeof parsedData === 'string') {
      parsedData = JSON.parse(parsedData);
    }
    docs = parsedData;
  } catch (e) {
    console.error(`[generateBespokeDocs] ❌ DeepSeek parse error:`, rawDocText)
    docs = {
      resumeHtml: "<html><body style='font-family:Lato; padding:40px'><h1>Resume</h1><p>AI formatting error. No resume generated.</p></body></html>",
      coverLetterHtml: "<html><body style='font-family:Lato; padding:40px'><h1>Cover Letter</h1><p>AI formatting error. No cover letter generated.</p></body></html>",
      changes_made: "Fallback mode activated due to AI parse error.",
      reasoning: "DeepSeek failed to format response correctly."
    }
  }

  console.log(`[generateBespokeDocs] ✅ NVIDIA responded. Rendering PDFs...`)

  // Render HTML to PDFs using Playwright
  const browser = await chromium.launch({ headless: true })
  let resumePdfBuffer: Buffer
  let coverLetterPdfBuffer: Buffer
  try {
    const renderContext = await browser.newContext()
    const renderPage = await renderContext.newPage()

    await renderPage.setContent(docs.resumeHtml, { waitUntil: "networkidle" })
    resumePdfBuffer = await renderPage.pdf({ format: 'A4' })

    await renderPage.setContent(docs.coverLetterHtml, { waitUntil: "networkidle" })
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
    try {
      const jdText = await scrapeJobPage(jobUrl)
      console.log(`[applyJob] Scraped ${jdText.length} characters from JD.`)

      if (userId && jobMeta?.id) {
        await generateBespokeDocs({
          jdText,
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

    // Data Lake is the sole source of truth (populated by background harvester)
    if (unEvaluatedJobs.length === 0) {
      console.log(`[huntJobs] No matching jobs found in the Data Lake for this search.`)
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

// ── Seed Harvester (One-Shot Data Lake Population) ──────────────────

export async function seedHarvester(req: Request, res: Response): Promise<void> {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500
  console.log(`\n===========================================`)
  console.log(`[seedHarvester] Manual seed triggered. Harvesting ${limit} jobs from Apify...`)
  console.log(`===========================================`)

  try {
    const jobs = await harvestAllSources(limit)
    console.log(`[seedHarvester] Harvested ${jobs.length} jobs. Upserting into global_jobs...`)

    if (jobs.length === 0) {
      res.json({ success: true, message: 'Harvest returned 0 jobs. Check Apify token and actor availability.', inserted: 0 })
      return
    }

    // Upsert with ON CONFLICT (apply_url) DO NOTHING
    const { data, error } = await supabase
      .from('global_jobs')
      .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })
      .select()

    if (error) {
      console.error(`[seedHarvester] ❌ Upsert error:`, error.message)
      res.status(500).json({ error: 'Upsert Failed', message: error.message })
      return
    }

    console.log(`[seedHarvester] ✅ Seeded ${data?.length || 0} new jobs into global_jobs.`)
    res.json({
      success: true,
      harvested: jobs.length,
      inserted: data?.length || 0,
      sources: {
        greenhouse: jobs.filter(j => j.api_source === 'greenhouse').length,
        lever: jobs.filter(j => j.api_source === 'lever').length,
        ashby: jobs.filter(j => j.api_source === 'ashby').length,
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[seedHarvester] ❌ Unhandled error:`, message)
    res.status(500).json({ error: 'Internal Server Error', message })
  }
}
