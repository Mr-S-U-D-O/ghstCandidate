import { Request, Response } from "express"
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"

let _genAI: GoogleGenerativeAI | null = null
function getGenAI() {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY")
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return _genAI
}

export async function chatProfiler(req: Request, res: Response): Promise<void> {
  try {
    const { currentProfile, userMessage, chatHistory } = req.body

    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            reply: { type: SchemaType.STRING },
            profileUpdates: {
              type: SchemaType.OBJECT,
              // any missing piece of info like "salary", "githubUrl", "visa"
            }
          },
          required: ["reply", "profileUpdates"]
        } as any
      }
    })

    const prompt = `
You are the Ghost Worker, an elite recruiter AI. Your goal is to build a complete profile of the candidate.
Review their currentProfile. Find what is missing (e.g., salary expectations, GitHub/portfolio links, Visa sponsorship needs, specific tech skills).
Respond to their userMessage.
You MUST return a strict JSON response with two keys:
- reply: A friendly, conversational question asking for ONE missing piece of information.
- profileUpdates: A JSON object containing any NEW facts you learned from their latest userMessage that should be added to their profile (e.g., { "githubUrl": "https://github.com/jane" }). If no new facts, return {}.

Candidate Profile:
${JSON.stringify(currentProfile)}

Chat History:
${JSON.stringify(chatHistory)}

User Message:
${userMessage}
`.trim()

    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()
    const parsed = JSON.parse(rawText)

    res.json(parsed)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[chatProfiler] Execution failed:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  }
}
