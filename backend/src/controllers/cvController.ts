import { Request, Response } from "express"
import OpenAI from "openai"

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    if (!process.env.NVIDIA_API_KEY) throw new Error("Missing NVIDIA_API_KEY")
    _openai = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: "https://integrate.api.nvidia.com/v1"
    })
  }
  return _openai
}

export async function parseCv(req: Request, res: Response): Promise<void> {
  try {
    const { base64Pdf, mode } = req.body

    if (!base64Pdf || typeof base64Pdf !== "string") {
      res.status(400).json({ error: "Bad Request", message: "A valid base64Pdf string is required." })
      return
    }

    console.log(`[parseCv] Parsing uploaded document (mode: ${mode || 'cv'})...`)

    const openai = getOpenAI()

    let prompt = ""
    if (mode === "cover_letter") {
      prompt = `
You are an ATS parser. The attached document is a base64 encoded PDF.
Step 1: Validate if it is a Cover Letter. If it is NOT, return { "isValid": false }.
Step 2: If it IS a Cover Letter, return { "isValid": true } and extract the full comprehensive text of the letter into the 'rawText' field. Provide a highly accurate, verbatim transcription or comprehensive summary of the text to prevent data loss.

IMPORTANT: You MUST return ONLY valid JSON. Do not wrap it in markdown \`\`\`json blocks.
`.trim()
    } else {
      prompt = `
You are an ATS parser. The attached document is a base64 encoded PDF.
Step 1: Validate if it is a CV/Resume. If it is NOT, return { "isValid": false }.
Step 2: If it IS a CV, extract the data and return strict JSON matching this structure exactly (ensure all these keys exist):
- isValid (boolean)
- name (string)
- email (string)
- skills (array of strings)
- experienceSummary (string)
- locations (array of strings)
- targetRoles (array of strings)
- education_level (string)
- highest_degree_major (string)
- years_of_experience (number)
- linkedin_url (string)
- portfolio_url (string)
- rawText (string)

- For 'locations', extract any locations they mention.
- For 'targetRoles', infer their target roles based on their recent experience or summary.
- For 'rawText', provide a highly accurate comprehensive text summary or transcription of the entire document.
- Ensure 'years_of_experience' is a number.

IMPORTANT: You MUST return ONLY valid JSON. Do not wrap it in markdown \`\`\`json blocks.
`.trim()
    }

    // Gemini expected inlineData, but for DeepSeek we pass the base64 string directly into the prompt text 
    // since it can handle extremely large contexts (1M tokens) and we are migrating off Gemini entirely.
    const base64Data = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf
    prompt += "\n\nBase64 PDF Content:\n" + base64Data

    const completion = await openai.chat.completions.create({
      model: "deepseek-ai/deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 16384,
      // @ts-ignore
      chat_template_kwargs: { "thinking": true, "reasoning_effort": "high" },
      response_format: { type: "json_object" }
    })

    let rawText = completion.choices[0]?.message?.content || "{}"
    rawText = rawText.trim().replace(/^```json/, '').replace(/```$/, '').trim()
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
