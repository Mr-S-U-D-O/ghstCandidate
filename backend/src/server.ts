import express, { Request, Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import { GoogleGenerativeAI } from "@google/generative-ai"

// ── Bootstrap ──────────────────────────────────────────────────────
dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 3001

// ── Middleware ─────────────────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000"] }))
app.use(express.json())

// ── Gemini Client ──────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "")
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

// ── Types ──────────────────────────────────────────────────────────
interface CandidateProfile {
  name?: string
  skills: string[]
  experience: string
  preferences: {
    roles: string[]
    workType: string
    location?: string
  }
}

interface AnalyzeJobRequest {
  candidateProfile: CandidateProfile
  jobDescription: string
}

interface AnalyzeJobResponse {
  matchScore: number
  verdict: string
  matchedSkills: string[]
  missingSkills: string[]
  executionPlan: {
    type: "action" | "warn"
    text: string
  }[]
}

// ── Health Check ───────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "ghstCandidate-backend" })
})

// ── POST /api/analyze-job ──────────────────────────────────────────
app.post("/api/analyze-job", async (req: Request, res: Response) => {
  try {
    const { candidateProfile, jobDescription } = req.body as AnalyzeJobRequest

    if (!candidateProfile || !jobDescription) {
      res.status(400).json({ error: "candidateProfile and jobDescription are required." })
      return
    }

    const prompt = `
You are an expert job-matching AI for a platform called ghstCandidate.

Analyze the following job description against the candidate profile and return a structured JSON response. Do NOT return markdown, code fences, or any text outside the JSON object.

## Candidate Profile
- Name: ${candidateProfile.name ?? "Anonymous"}
- Skills: ${candidateProfile.skills.join(", ")}
- Experience Summary: ${candidateProfile.experience}
- Target Roles: ${candidateProfile.preferences.roles.join(", ")}
- Work Type Preference: ${candidateProfile.preferences.workType}
- Location Preference: ${candidateProfile.preferences.location ?? "Any"}

## Job Description
${jobDescription}

## Your Task
Return a JSON object with EXACTLY this shape:
{
  "matchScore": <integer 0-100>,
  "verdict": "<2-4 sentence plain-English summary of why this is or is not a good match. Be specific. Reference actual skills or requirements from the JD.>",
  "matchedSkills": ["<skill1>", "<skill2>", ...],
  "missingSkills": ["<gap1>", "<gap2>", ...],
  "executionPlan": [
    { "type": "action", "text": "<what the Ghost will do automatically>" },
    { "type": "warn", "text": "<what requires human input, if anything>" }
  ]
}

Rules:
- matchScore must reflect a genuine assessment, not a default.
- matchedSkills should be 3-5 concrete skills from both the candidate AND job description.
- missingSkills should be 1-3 honest gaps, or an empty array if none.
- executionPlan should have 2-4 items. Include a "warn" item ONLY if the job asks for something that needs human review (salary, portfolio, references, etc.).
- Return ONLY valid JSON. No markdown, no commentary.
`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()

    let parsed: AnalyzeJobResponse
    try {
      parsed = JSON.parse(cleaned) as AnalyzeJobResponse
    } catch {
      console.error("Gemini returned non-JSON:", cleaned)
      res.status(502).json({ error: "Gemini returned an unparseable response.", raw: cleaned })
      return
    }

    res.json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[/api/analyze-job] Error:", message)
    res.status(500).json({ error: "Internal server error.", details: message })
  }
})

// ── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ghstCandidate backend running on http://localhost:${PORT}`)
})
