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

export async function parseCv(req: Request, res: Response): Promise<void> {
  try {
    const { base64Pdf } = req.body

    if (!base64Pdf || typeof base64Pdf !== "string") {
      res.status(400).json({ error: "Bad Request", message: "A valid base64Pdf string is required." })
      return
    }

    console.log(`[parseCv] Parsing uploaded CV...`)

    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isValid: { type: SchemaType.BOOLEAN },
            name: { type: SchemaType.STRING },
            email: { type: SchemaType.STRING },
            skills: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING } 
            },
            experienceSummary: { type: SchemaType.STRING },
            locations: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING } 
            },
            targetRoles: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING } 
            }
          },
          required: ["isValid"]
        } as any
      }
    })

    const prompt = `
You are an ATS parser. The attached document is a base64 encoded PDF.
Step 1: Validate if it is a CV/Resume. If it is NOT, return { "isValid": false }.
Step 2: If it IS a CV, extract the data and return strict JSON matching the schema.
For 'locations', extract any locations they mention. For 'targetRoles', infer their target roles based on their recent experience or summary.
`.trim()

    // Gemini expects the base64 string without the data URI prefix (e.g., data:application/pdf;base64,...)
    const base64Data = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf

    const result = await model.generateContent([
      { inlineData: { data: base64Data, mimeType: "application/pdf" } },
      prompt
    ])

    const rawText = result.response.text().trim()
    const parsed = JSON.parse(rawText)

    if (parsed.isValid) {
      console.log(`[parseCv] Successfully parsed CV for: ${parsed.name}`)
    } else {
      console.log(`[parseCv] Uploaded document is not a valid CV.`)
    }

    res.json(parsed)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[parseCv] Execution failed:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  }
}
