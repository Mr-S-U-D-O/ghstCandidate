import { Request, Response } from "express"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import { supabase } from "../supabaseClient"

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

export async function chatProfiler(req: Request, res: Response): Promise<void> {
  try {
    const { currentProfile, userMessage, chatHistory } = req.body
    console.log(`\n===========================================`)
    console.log(`[chatProfiler] Incoming chat request.`)
    console.log(`[chatProfiler] Message: "${userMessage}"`)
    console.log(`[chatProfiler] History length: ${chatHistory ? chatHistory.length : 0} messages`)
    console.log(`===========================================`)

    const prompt = `
You are the Ghost Worker, an elite recruiter AI. Your goal is to build a complete profile of the candidate.
Review their currentProfile. Find what is missing (e.g., salary expectations, GitHub/portfolio links, Visa sponsorship needs, specific tech skills).
Respond to their userMessage.
You MUST return a strict JSON response with two keys:
- reply: A friendly, conversational question asking for ONE missing piece of information.
- profileUpdates: A JSON object containing any NEW facts you learned from their latest userMessage that should be added to their profile (e.g., { "githubUrl": "https://github.com/jane" }). If no new facts, return {}.
- new_memories: An array of objects with "memory_key" and "memory_value" whenever you learn a distinct, new fact about the candidate (e.g., preferred tech stack, visa status, salary expectations). If no new distinct facts, return [].

IMPORTANT: You MUST return ONLY valid JSON matching this structure. Do NOT wrap it in markdown \`\`\`json block quotes.

Candidate Profile:
${JSON.stringify(currentProfile)}

Chat History:
${JSON.stringify(chatHistory)}

User Message:
${userMessage}
`.trim()

    const openai = getOpenAI()
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
