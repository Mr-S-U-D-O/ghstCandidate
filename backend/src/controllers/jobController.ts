import { Request, Response } from "express"
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"

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
  candidateProfile: CandidateProfile
  jobDescription: string
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

// ── Response Schema for guaranteed JSON structure ─────────────────

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    company: { type: SchemaType.STRING, description: "Company name extracted from the job description" },
    role: { type: SchemaType.STRING, description: "Job title extracted from the job description" },
    matchScore: { type: SchemaType.NUMBER, description: "Integer 0-100 representing how well the candidate matches the role" },
    verdict: { type: SchemaType.STRING, description: "2-3 sentence honest summary of the match quality. Reference specific skills or requirements." },
    matchesFound: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "3-5 specific skills or experiences from the candidate that match the job requirements"
    },
    missingOrWeak: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "1-3 honest skill gaps or weak points relative to the job. Empty array if none."
    },
    humanInputRequired: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Fields or questions in the application that the Ghost cannot auto-fill and require human input (e.g. Desired Salary, Visa Status). Empty array if none."
    }
  },
  required: ["company", "role", "matchScore", "verdict", "matchesFound", "missingOrWeak", "humanInputRequired"]
}

// ── Controller ────────────────────────────────────────────────────

export async function analyzeJob(req: Request, res: Response): Promise<void> {
  try {
    const { candidateProfile, jobDescription } = req.body as AnalyzeJobPayload

    // Validate input
    if (!candidateProfile || typeof jobDescription !== "string" || jobDescription.trim().length === 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Both candidateProfile and jobDescription (non-empty string) are required."
      })
      return
    }

    if (!Array.isArray(candidateProfile.skills) || !candidateProfile.experience) {
      res.status(400).json({
        error: "Bad Request",
        message: "candidateProfile must include skills (array) and experience (string)."
      })
      return
    }

    // Build prompt
    const prompt = `
You are the Ghost Worker — an elite technical recruiter AI embedded in the ghstCandidate platform.

Your task is to analyse a job description against a candidate's profile and produce a structured match report.
Be honest, specific, and technical. Do not give inflated scores. Do not hallucinate skills that are not mentioned.

## Candidate Profile
- Name: ${candidateProfile.name ?? "Anonymous"}
- Skills: ${candidateProfile.skills.join(", ")}
- Experience: ${candidateProfile.experience}
- Target Roles: ${candidateProfile.preferences.roles.join(", ")}
- Work Type: ${candidateProfile.preferences.workType}
- Location Preference: ${candidateProfile.preferences.location ?? "No preference"}

## Job Description
${jobDescription.trim()}

## Instructions
- Extract the company name and job title from the job description.
- Score the match honestly from 0-100.
- List 3-5 specific things from the candidate's profile that match requirements in the JD.
- List 1-3 honest gaps. If there are none, return an empty array.
- List any fields in the application the Ghost cannot auto-fill (salary, portfolio links, visa questions, cover letter). If none, return empty array.
- The verdict should be 2-3 sentences, specific to this pairing — not generic boilerplate.
`.trim()

    // Call Gemini with response schema for guaranteed structure
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite", 
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any,
      },
    });

    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()

    // Parse — schema enforcement makes this very reliable, but guard anyway
    let parsed: JobAnalysisResult
    try {
      parsed = JSON.parse(rawText) as JobAnalysisResult
    } catch (parseErr) {
      console.error("[analyzeJob] Gemini returned non-JSON despite schema:", rawText)
      res.status(502).json({
        error: "Parse Error",
        message: "Gemini returned an unexpected response format.",
        raw: rawText
      })
      return
    }

    // Clamp matchScore to valid range
    parsed.matchScore = Math.max(0, Math.min(100, Math.round(parsed.matchScore)))

    console.log(`[analyzeJob] Analyzed "${parsed.role}" at "${parsed.company}" — score: ${parsed.matchScore}`)
    res.json(parsed)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[analyzeJob] Unhandled error:", message)
    res.status(500).json({
      error: "Internal Server Error",
      message
    })
  }
}
