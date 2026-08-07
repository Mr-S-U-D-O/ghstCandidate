import { Request, Response, NextFunction } from "express"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "../utils/supabaseAdmin.js"
import { ingestFeeds } from "../utils/cron/harvester.js"
import { supabase } from "../supabaseClient.js"
import { addFleetLogClient, emitFleetLog } from "../utils/fleetLogger.js"

// ── Middleware: Is Admin ──────────────────────────────────────────

export async function isAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized", message: "Missing authorization header" })
    return
  }

  try {
    const token = authHeader.replace("Bearer ", "")
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" })
      return
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      res.status(403).json({ error: "Forbidden", message: "User is not an admin" })
      return
    }

    next()
  } catch (error) {
    console.error("[isAdmin] Middleware error:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

// ── Controllers ───────────────────────────────────────────────────

export function streamFleetLogs(req: Request, res: Response): void {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send an initial connected message
  res.write(`data: ${JSON.stringify(`[${new Date().toLocaleTimeString()}] Connected to Fleet Logger stream...`)}\n\n`);

  addFleetLogClient(res);
}

export async function getFleetConfigs(req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('apify_fleet_configs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch fleet configs", message: error.message })
  }
}

export async function createFleetConfig(req: Request, res: Response): Promise<void> {
  try {
    const { niche_name, api_key, search_queries, max_items_per_actor } = req.body
    
    if (!niche_name || !api_key) {
      res.status(400).json({ error: "Bad Request", message: "niche_name and api_key are required" })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('apify_fleet_configs')
      .insert({
        niche_name,
        api_key,
        search_queries: search_queries || [],
        max_items_per_actor: max_items_per_actor || 200
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create fleet config", message: error.message })
  }
}

export async function updateFleetConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const updates = req.body

    const { data, error } = await supabaseAdmin
      .from('apify_fleet_configs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update fleet config", message: error.message })
  }
}

export async function deleteFleetConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const { error } = await supabaseAdmin
      .from('apify_fleet_configs')
      .delete()
      .eq('id', id)

    if (error) throw error

    res.json({ success: true, message: "Deleted successfully" })
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete fleet config", message: error.message })
  }
}

export async function triggerHarvester(req: Request, res: Response): Promise<void> {
  const { configId } = req.body;
  
  emitFleetLog(`\n===========================================`)
  if (configId) {
    emitFleetLog(`[Admin/triggerHarvester] Manual admin trigger: forcing single Apify config run (ID: ${configId})...`)
  } else {
    emitFleetLog(`[Admin/triggerHarvester] Manual admin trigger: forcing full Apify Fleet run...`)
  }
  emitFleetLog(`===========================================`)

  // Return immediately to prevent timeout, and run in background
  res.json({ success: true, message: "Harvester triggered in background." })

  try {
    const freshJobs = await ingestFeeds(configId)
    emitFleetLog(`[Admin/triggerHarvester] Ingested ${freshJobs.length} jobs. Upserting into global_jobs...`)

    if (freshJobs.length === 0) {
      emitFleetLog("[Admin/triggerHarvester] Harvest returned 0 jobs.")
      return
    }

    const mappedGlobalJobs = freshJobs.map(j => ({
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description_html,
      apply_url: j.apply_url,
      api_source: j.source
    }))

    const { data, error } = await supabaseAdmin
      .from('global_jobs')
      .upsert(mappedGlobalJobs, { onConflict: 'apply_url', ignoreDuplicates: true })
      .select()

    if (error) {
      emitFleetLog(`[Admin/triggerHarvester] ❌ Upsert error: ${error.message}`)
      return
    }

    emitFleetLog(`[Admin/triggerHarvester] ✅ Seeded ${data?.length || 0} new jobs into global_jobs.`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    emitFleetLog(`[Admin/triggerHarvester] ❌ Unhandled error: ${message}`)
  }
}
