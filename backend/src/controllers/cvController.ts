import { Request, Response } from "express"
import pdfParse from "pdf-parse"
import { generateCompletion } from "../utils/ai.js"

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

    let systemPrompt = ""
    if (mode === "cover_letter") {
      systemPrompt = `
You are an ATS parser. Return ONLY JSON. Do not include summaries, conversational text, or null fields.
Step 1: Validate if it is a Cover Letter. If it is NOT, return { "isValid": false }.
Step 2: If it IS a Cover Letter, return { "isValid": true } and extract the full comprehensive text of the letter into the 'rawText' field.
`.trim()
    } else {
      systemPrompt = `
You are an ATS parser. Return ONLY JSON. Do not include summaries, conversational text, or null fields.
Step 1: Validate if it is a CV/Resume. If it is NOT, return { "isValid": false }.
Step 2: If it IS a CV, extract the data and return strict JSON matching this structure exactly:
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
- rawText (string) - highly accurate comprehensive text summary of the entire document.
`.trim()
    }

    const prompt = "\n\nDocument Text:\n" + pdfText

    const rawText = await generateCompletion({
      prompt: prompt,
      systemPrompt: systemPrompt,
      maxTokens: 2000,
      jsonMode: true
    })
    
    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch (e) {
      console.error("[parseCv] Failed to parse JSON. Raw text was:", rawText.substring(0, 500) + '...')
      throw new Error("AI returned malformed JSON.")
    }

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
