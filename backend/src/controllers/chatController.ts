import { Request, Response } from "express"
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
import { supabase } from "../supabaseClient"

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
    console.log(`\n===========================================`)
    console.log(`[chatProfiler] Incoming chat request.`)
    console.log(`[chatProfiler] Message: "${userMessage}"`)
    console.log(`[chatProfiler] History length: ${chatHistory ? chatHistory.length : 0} messages`)
    console.log(`===========================================`)

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
            },
            new_memories: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  memory_key: { type: SchemaType.STRING },
                  memory_value: { type: SchemaType.STRING }
                },
                required: ["memory_key", "memory_value"]
              }
            }
          },
          required: ["reply", "profileUpdates", "new_memories"]
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
- new_memories: An array of objects with "memory_key" and "memory_value" whenever you learn a distinct, new fact about the candidate (e.g., preferred tech stack, visa status, salary expectations). If no new distinct facts, return [].

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

    console.log(`[chatProfiler] ✅ Gemini responded. Profile updates:`, Object.keys(parsed.profileUpdates || {}).length > 0 ? parsed.profileUpdates : 'None')

    // Auto-Memory Extraction
    if (parsed.new_memories && parsed.new_memories.length > 0) {
      const authHeader = req.headers.authorization
      let scopedSupabase = supabase
      if (authHeader) {
        scopedSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
          global: { headers: { Authorization: authHeader } }
        })
      } else {
        console.warn(`[chatProfiler] ⚠️ Missing Authorization header. RLS operations may fail.`)
      }

      console.log(`[chatProfiler] Extracting ${parsed.new_memories.length} new memories to candidate_memories table...`)
      
      const memoriesToInsert = parsed.new_memories.map((mem: any) => ({
        user_id: currentProfile?.id,
        memory_key: mem.memory_key,
        memory_value: mem.memory_value,
        source: 'ghost_chat'
      })).filter((mem: any) => mem.user_id)

      if (memoriesToInsert.length > 0) {
        const { error: insertError } = await scopedSupabase.from('candidate_memories').insert(memoriesToInsert)
        if (insertError) {
          console.error(`❌ [chatProfiler] Failed to save candidate_memories:`, insertError)
        } else {
          console.log(`✅ [chatProfiler] Successfully saved ${memoriesToInsert.length} memories.`)
        }
      } else {
        console.log(`[chatProfiler] No memories to insert (missing user_id).`)
      }
    } else {
      console.log(`[chatProfiler] No new memories extracted this turn.`)
    }

    res.json(parsed)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[chatProfiler] Execution failed:", message)
    res.status(500).json({ error: "Internal Server Error", message })
  }
}
