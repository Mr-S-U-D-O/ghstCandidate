import { Request, Response } from "express"
import { Stagehand } from "@browserbasehq/stagehand"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { supabase } from "../supabaseClient.js"
import { generateBespokeDocs } from "./jobController.js"
import type { CandidateProfile } from "./jobController.js"

// ── Types ────────────────────────────────────────────────────────────

interface RunAgentBody {
  jobId: string
  jobUrl: string
  candidateProfile: CandidateProfile
  userId: string
  jobTitle?: string
  company?: string
}

// ── Login Wall Detector ─────────────────────────────────────────────

const LOGIN_WALL_SELECTORS = [
  'input[type="password"]',
  '[data-testid*="login"]',
  '[data-testid*="signin"]',
  '[class*="login"]',
  '[class*="sign-in"]',
  '[id*="login"]',
  '[id*="signin"]',
]

const LOGIN_WALL_PHRASES = [
  'sign in to apply',
  'log in to apply',
  'create an account to apply',
  'please sign in',
  'register to apply',
  'join to apply',
  'connect with linkedin',
]

// ── Stagehand extraction schema ─────────────────────────────────────

const FormStateSchema = z.object({
  hasFileUpload: z.boolean().describe("Does the page contain a resume/CV file upload input (input[type=file])?"),
  unknownQuestion: z.string().optional().describe("The exact text of any required form question the agent cannot answer from the candidate profile. Empty string if none."),
  isComplete: z.boolean().describe("True if all visible required form fields have been filled and the form is ready to submit."),
})

// ── Agent Controller ─────────────────────────────────────────────────

export async function runAgent(req: Request, res: Response): Promise<void> {
  const { jobId, jobUrl, candidateProfile, userId, jobTitle, company } = req.body as RunAgentBody

  console.log(`\n===========================================`)
  console.log(`[runAgent] Autonomous agent starting.`)
  console.log(`[runAgent] User ID: ${userId}`)
  console.log(`[runAgent] Job ID: ${jobId}`)
  console.log(`[runAgent] Job URL: ${jobUrl}`)
  console.log(`===========================================`)

  // ── Input validation ───────────────────────────────────────────────
  if (!jobId || !jobUrl || !userId || !candidateProfile) {
    console.warn(`[runAgent] Missing required parameters. Aborting.`)
    res.status(400).json({ error: "Bad Request", message: "jobId, jobUrl, userId, and candidateProfile are all required." })
    return
  }

  // ── Build scoped Supabase client (RLS bypass) ───────────────────────
  const authHeader = req.headers.authorization
  if (!authHeader) {
    console.warn(`[runAgent] \u26a0\ufe0f Missing Authorization header. RLS operations may fail.`)
  }
  let scopedSupabase = supabase
  if (authHeader) {
    scopedSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
      global: { headers: { Authorization: authHeader } }
    })
    console.log(`[runAgent] Scoped Supabase client created with user JWT.`)
  }

  // ── Fetch candidate memories ───────────────────────────────────────
  let memories: { memory_key: string; memory_value: string }[] = []
  console.log(`[runAgent] Fetching candidate memories for user ${userId}...`)
  const { data: memData, error: memErr } = await scopedSupabase
    .from('candidate_memories')
    .select('memory_key, memory_value')
    .eq('user_id', userId)
  if (memErr) {
    console.error(`[runAgent] \u26a0\ufe0f Failed to fetch memories:`, memErr)
  } else {
    memories = memData || []
    console.log(`[runAgent] \u2705 Fetched ${memories.length} memories.`)
  }

  // ── Build profile context string ───────────────────────────────────
  const memoriesText = memories.length > 0
    ? `\nLearned Facts:\n${memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
    : ''

  const profileContext = `
Candidate Name: ${candidateProfile.name}
Email: ${candidateProfile.email}
Skills: ${(candidateProfile.skills || []).join(', ')}
Target Roles: ${(candidateProfile.targetRoles || []).join(', ')}
Locations: ${(candidateProfile.locations || []).join(', ')}
${memoriesText}
`.trim()

  // ── Helper: update job status in Supabase ──────────────────────────
  async function updateJobStatus(updates: Record<string, unknown>) {
    const { error } = await scopedSupabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)
    if (error) {
      console.error(`[runAgent] \u274c Failed to update job status:`, error)
    } else {
      console.log(`[runAgent] \u2705 Job status updated:`, updates)
    }
  }

  // ── Initialize Stagehand ───────────────────────────────────────────
  console.log(`[runAgent] Initializing Stagehand (LOCAL mode)...`)
  const stagehand: any = new Stagehand({
    env: "LOCAL",
    verbose: 1,
    localBrowserLaunchOptions: {
      headless: process.env.HEADLESS === 'false' ? false : true
    }
  })

  try {
    await stagehand.init()
    console.log(`[runAgent] ✅ Stagehand initialized.`)

    const page = stagehand.page || stagehand.context?.activePage()

    // ── Step 5: Navigate ───────────────────────────────────────────
    console.log(`[runAgent] Navigating to: ${jobUrl}`)
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(2000)

    // ── Step 5.5: Login Wall Triage ────────────────────────────────
    console.log(`[runAgent] Running Login Wall Triage...`)

    let hasLoginWall = false

    // CSS selector check
    for (const selector of LOGIN_WALL_SELECTORS) {
      const el = await page.$(selector)
      if (el) {
        console.warn(`[runAgent] \ud83d\udea7 Login wall detected via selector: "${selector}"`)
        hasLoginWall = true
        break
      }
    }

    // Page text check
    if (!hasLoginWall) {
      const pageText = await page.evaluate(() => document.body.innerText?.toLowerCase() ?? '')
      for (const phrase of LOGIN_WALL_PHRASES) {
        if (pageText.includes(phrase)) {
          console.warn(`[runAgent] \ud83d\udea7 Login wall detected via page text: "${phrase}"`)
          hasLoginWall = true
          break
        }
      }
    }

    if (hasLoginWall) {
      console.warn(`[runAgent] Login wall confirmed. Aborting agent — no docs generated (tokens saved).`)
      await stagehand.close()

      await updateJobStatus({
        needs_input: true,
        missing_field: 'requires_manual_login'
      })

      res.status(200).json({
        success: false,
        status: 'REQUIRES_LOGIN',
        missingField: 'Login wall detected — this job requires you to sign in manually before applying.'
      })
      return
    }

    console.log(`[runAgent] \u2705 No login wall detected. Proceeding with form fill.`)

    // ── Step 6: Initial form state observation ─────────────────────
    console.log(`[runAgent] Observing initial form state...`)
    let formState = await stagehand.page.extract({
      instruction: "Assess this job application form. Look for: any file upload inputs, any required questions you cannot answer without user data, and whether the form looks complete.",
      schema: FormStateSchema,
    })
    console.log(`[runAgent] Initial form state:`, formState)

    if (formState.unknownQuestion && formState.unknownQuestion.trim() !== '') {
      const unknownQ = formState.unknownQuestion.trim()
      console.warn(`[runAgent] \u26a0\ufe0f Unknown question on initial observe: "${unknownQ}"`)
      await stagehand.close()
      await updateJobStatus({ needs_input: true, missing_field: `NEEDS_INPUT: ${unknownQ}` })
      res.status(200).json({ success: false, status: 'NEEDS_INPUT', missingField: unknownQ })
      return
    }

    // ── Step 7: Form Fill Action ───────────────────────────────────
    console.log(`[runAgent] Executing form fill action...`)
    const fillInstruction = `
Fill out this job application form using the following candidate profile. Do NOT click submit yet.

${profileContext}

Rules:
- Fill every visible field you can identify from the profile above.
- For dropdowns, select the most appropriate option.
- If you encounter a required question you CANNOT answer (e.g., specific salary expectation, unusual work authorization question, highly specific technical scenario), throw an error with the prefix "NEEDS_INPUT: " followed by the exact question text.
- Do NOT fabricate answers. Do NOT guess. Do NOT click the submit/apply button.
`.trim()

    try {
      await stagehand.page.act({ action: fillInstruction })
      console.log(`[runAgent] \u2705 Form fill action complete.`)
    } catch (actErr: any) {
      const msg: string = actErr?.message ?? String(actErr)
      if (msg.toLowerCase().includes('needs_input')) {
        const unknownQ = msg.replace(/^.*NEEDS_INPUT:\s*/i, '').trim()
        console.warn(`[runAgent] \u26a0\ufe0f NEEDS_INPUT thrown during fill: "${unknownQ}"`)
        await stagehand.close()
        await updateJobStatus({ needs_input: true, missing_field: `NEEDS_INPUT: ${unknownQ}` })
        res.status(200).json({ success: false, status: 'NEEDS_INPUT', missingField: unknownQ })
        return
      }
      throw actErr
    }

    // Re-observe after fill
    console.log(`[runAgent] Re-observing form state after fill...`)
    formState = await stagehand.page.extract({
      instruction: "Re-assess the form after filling. Does it now have a file upload input? Is there still an unknown required question? Is the form ready to submit?",
      schema: FormStateSchema,
    })
    console.log(`[runAgent] Post-fill form state:`, formState)

    if (formState.unknownQuestion && formState.unknownQuestion.trim() !== '') {
      const unknownQ = formState.unknownQuestion.trim()
      console.warn(`[runAgent] \u26a0\ufe0f Unknown question detected post-fill: "${unknownQ}"`)
      await stagehand.close()
      await updateJobStatus({ needs_input: true, missing_field: `NEEDS_INPUT: ${unknownQ}` })
      res.status(200).json({ success: false, status: 'NEEDS_INPUT', missingField: unknownQ })
      return
    }

    // ── Step 8: JIT Document Generation (only when file upload confirmed) ──
    if (formState.hasFileUpload) {
      console.log(`[runAgent] \ud83d\udcce File upload detected. Triggering JIT document generation...`)

      // Capture JD text inline from current page (we're already on it)
      let jdText = ''
      try {
        const raw = await page.evaluate(() => document.body.innerText?.trim() ?? '')
        jdText = raw.slice(0, 6000)
        console.log(`[runAgent] JD text captured: ${jdText.length} chars`)
      } catch (e) {
        console.warn(`[runAgent] Could not capture JD text inline:`, e)
      }

      const docs = await generateBespokeDocs({
        jdText,
        candidateProfile,
        memories,
        userId,
        jobId,
        jobTitle: jobTitle || 'Unknown Role',
        company: company || 'Unknown Company',
        scopedSupabase
      })
      console.log(`[runAgent] \u2705 JIT docs generated. Resume URL: ${docs.resumeUrl}`)

      // Upload PDF to file input
      try {
        await page.setInputFiles('input[type="file"]', {
          name: `${(candidateProfile.name || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`,
          mimeType: 'application/pdf',
          buffer: docs.resumePdfBuffer,
        })
        console.log(`[runAgent] \u2705 Resume PDF set on file input.`)
      } catch (fileErr) {
        console.warn(`[runAgent] \u26a0\ufe0f setInputFiles failed (may still proceed):`, fileErr)
      }
    } else {
      console.log(`[runAgent] No file upload input present. Skipping JIT doc generation (tokens saved).`)
    }

    // ── Step 9: Submit ─────────────────────────────────────────────
    console.log(`[runAgent] Submitting the application...`)
    try {
      await stagehand.page.act({
        action: "Find and click the final submit or 'Apply Now' button to submit the completed job application. Only click once.",
      })
      console.log(`[runAgent] \u2705 Submit action complete.`)
      await page.waitForTimeout(3000)
    } catch (submitErr) {
      console.warn(`[runAgent] \u26a0\ufe0f Submit action warning (may have succeeded):`, submitErr)
    }

    // ── Success ────────────────────────────────────────────────────
    await stagehand.close()
    console.log(`[runAgent] \u2705 Agent complete. Updating job column to 'applied'.`)

    await updateJobStatus({ column: 'applied', needs_input: false, missing_field: null })

    res.status(200).json({
      success: true,
      status: 'APPLIED',
      message: 'The Ghost has successfully submitted your application.'
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[runAgent] \u274c Unhandled error in agent loop:`, message)

    try { await stagehand.close() } catch {}

    if (message.toLowerCase().includes('needs_input')) {
      const unknownQ = message.replace(/^.*NEEDS_INPUT:\s*/i, '').trim()
      console.warn(`[runAgent] NEEDS_INPUT caught in top-level handler: "${unknownQ}"`)
      await updateJobStatus({ needs_input: true, missing_field: `NEEDS_INPUT: ${unknownQ}` })
      res.status(200).json({ success: false, status: 'NEEDS_INPUT', missingField: unknownQ })
      return
    }

    res.status(500).json({ error: "Internal Server Error", message })
  }
}
