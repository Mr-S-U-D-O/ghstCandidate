import { Request, Response } from "express"
import OpenAI from "openai"
import pdfParse from "pdf-parse"

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

    // Extract raw text from the PDF buffer
    const base64Data = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf
    const pdfBuffer = Buffer.from(base64Data, "base64")
    
    let parsedPdf;
    try {
      const parseFn = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || pdfParse;
      parsedPdf = await parseFn(pdfBuffer)
    } catch (pdfErr) {
      console.error("[parseCv] Failed to extract text from PDF:", pdfErr)
      res.status(422).json({ error: "Invalid PDF", message: "Could not read the PDF file. It might be corrupted or encrypted." })
      return
    }

    const pdfText = parsedPdf?.text ? parsedPdf.text.trim() : ''
    if (!pdfText || pdfText.length < 50) {
      console.log(`[parseCv] Extracted text is too short or empty. Length: ${pdfText.length}`)
      res.status(422).json({ error: "Empty PDF", message: "The PDF appears to be empty or image-based (no readable text). Please upload a text-based PDF CV." })
      return
    }

    console.log(`[parseCv] Extracted ${pdfText.length} characters from PDF. Sending to LLM...`)

    const openai = getOpenAI()

    let prompt = ""
    if (mode === "cover_letter") {
      prompt = `
You are an ATS parser. Extract data from this document text.
Step 1: Validate if it is a Cover Letter. If it is NOT, return { "isValid": false }.
Step 2: If it IS a Cover Letter, return { "isValid": true } and extract the full comprehensive text of the letter into the 'rawText' field. Provide a highly accurate, verbatim transcription or comprehensive summary of the text to prevent data loss.

IMPORTANT: You MUST return ONLY valid JSON. Do not wrap it in markdown \`\`\`json blocks.
`.trim()
    } else {
      prompt = `
You are an ATS parser. Extract data from this document text.
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

    prompt += "\n\nDocument Text:\n" + pdfText

    let completion: any = null
    let attempts = 0
    while (attempts < 3) {
      try {
        completion = await openai.chat.completions.create({
          model: "deepseek-ai/deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 8192,
          // @ts-ignore
          chat_template_kwargs: { "thinking": true, "reasoning_effort": "high" },
          response_format: { type: "json_object" }
        })
        break
      } catch (err: any) {
        attempts++
        if (err?.status === 529 || err?.status === 429 || err?.status >= 500) {
          console.log(`[parseCv] LLM API returned ${err?.status}. Retrying (${attempts}/3)...`)
          if (attempts >= 3) throw err
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempts - 1))) // 2s, 4s backoff
        } else {
          throw err
        }
      }
    }

    if (!completion) {
      throw new Error("Failed to get completion from LLM")
    }

    let rawText = completion.choices[0]?.message?.content || "{}"
    rawText = rawText.trim().replace(/^```json/, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(rawText)

    if (parsed.isValid) {
      console.log(`[parseCv] Successfully parsed document for: ${parsed.name || 'User'}`)
    } else {
      console.log(`[parseCv] Uploaded document is not a valid ${mode || 'CV'}.`)
    }

    res.json(parsed)

  } catch (err: any) {
    const message = err.message || String(err)
    console.error("[parseCv] Execution failed:", message)
    
    // Log extended OpenAI API errors (like 400 Bad Request reasons)
    if (err.status) {
      console.error(`[parseCv] API Error Status: ${err.status}`)
    }
    if (err.error) {
      console.error(`[parseCv] API Error Details:`, JSON.stringify(err.error, null, 2))
    }

    res.status(502).json({ 
      error: "AI Processing Error", 
      message: "The AI provider failed to process your document. Please try again or use a smaller PDF." 
    })
  }
}
