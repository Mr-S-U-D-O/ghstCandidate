import cron from "node-cron"
import { createClient } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient.js"
import { ingestFeeds } from "./utils/cron/harvester.js"

// ── Service Role Client ───────────────────────────────────────────────────────
// Used for cron-initiated writes to bypass RLS.
// The cron runner has no user JWT, so it must use the service role key directly
// for any INSERT/UPDATE operations into user-owned tables like `jobs`.

function getServiceClient() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
  if (!url || !serviceKey) throw new Error('[Cron] SUPABASE_URL or SUPABASE_SERVICE_KEY is not set.')
  return createClient(url, serviceKey)
}

export function initCron() {
  console.log("[Cron] Initializing Background Systems...")

  // ── The Harvester ───────────────────────────────────────────────
  // Runs every 6 hours (per RFC Section 6).
  // Fetches all registered providers and upserts results into global_jobs Data Lake.

  cron.schedule("0 */6 * * *", async () => {
    console.log("[Cron/Harvester] 🌾 Starting 6-hourly harvest cycle...")

    try {
      const jobs = await ingestFeeds()
      console.log(`[Cron/Harvester] Ingested ${jobs.length} jobs. Upserting into global_jobs...`)

      if (jobs.length === 0) {
        console.log("[Cron/Harvester] No jobs returned. Exiting cycle.")
        return
      }

      const mappedGlobalJobs = jobs.map(j => ({
        title: j.title,
        company: j.company,
        location: j.location,
        description: j.description_html,
        apply_url: j.apply_url,
        api_source: j.source
      }))

      const { data, error } = await supabase
        .from('global_jobs')
        .upsert(mappedGlobalJobs, { onConflict: 'apply_url', ignoreDuplicates: true })
        .select()

      if (error) {
        console.error("[Cron/Harvester] ❌ Upsert error:", error.message)
      } else {
        console.log(`[Cron/Harvester] ✅ Upserted ${data?.length || 0} new jobs into global_jobs.`)
      }

      console.log("[Cron/Harvester] 🌾 Harvest cycle complete.")
    } catch (e) {
      console.error("[Cron/Harvester] ❌ Unhandled error in harvest cycle:", e)
    }
  })

  console.log("[Cron] ✅ Harvester scheduled: 0 */6 * * * (Every 6 hours)")

  // ── The Sweeper ─────────────────────────────────────────────────
  // Runs daily at 4AM UTC.
  // Deletes jobs older than 14 days from the global_jobs Data Lake (per RFC).

  cron.schedule("0 4 * * *", async () => {
    console.log("[Cron/Sweeper] 🧹 Starting daily stale job purge...")

    try {
      // RFC Section 5: 14-day TTL (was previously 30 days)
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('global_jobs')
        .delete()
        .lt('created_at', fourteenDaysAgo)
        .select('id')

      if (error) {
        console.error("[Cron/Sweeper] ❌ Delete error:", error.message)
      } else {
        console.log(`[Cron/Sweeper] ✅ Purged ${data?.length || 0} stale jobs (older than 14 days).`)
      }
    } catch (e) {
      console.error("[Cron/Sweeper] ❌ Unhandled error in sweeper:", e)
    }
  })

  console.log("[Cron] ✅ Sweeper scheduled: 0 4 * * * (Daily 4AM UTC, 14-day TTL)")

  // ── Per-User Hunt + Auto-Apply Loop ─────────────────────────────
  // Run every 4 hours.
  // Iterates over all user profiles, hunts jobs from the Data Lake,
  // and auto-applies to high-match (>85%) jobs.
  //
  // BUG FIX: Previously called /api/apply-job (jobController, no Stagehand).
  // Now correctly targets /api/run-agent (agentController, full Stagehand execution).
  //
  // BUG FIX: Previously called hunt-jobs without an auth token, causing silent
  // RLS failures on jobs INSERT. Now uses the service role client directly for
  // DB operations within this loop.

  cron.schedule("0 */4 * * *", async () => {
    console.log("[Cron] Starting background job execution cycle...")

    try {
      const serviceClient = getServiceClient()

      // 1. Fetch all profiles using service client (bypasses RLS)
      const { data: profiles, error } = await serviceClient.from('profiles').select('*')
      if (error) {
        console.error("[Cron] Failed to fetch profiles:", error.message)
        return
      }
      if (!profiles || profiles.length === 0) {
        console.log("[Cron] No profiles found. Exiting cycle.")
        return
      }

      for (const row of profiles) {
        const userId = row.id
        const candidateProfile = {
          name: row.name || '',
          email: row.email || '',
          targetRoles: row.target_roles || [],
          locations: row.locations || [],
          skills: row.skills || [],
          rawResumeText: row.raw_resume_text || '',
          ...(row.extra_data || {})
        }

        const targetRole = candidateProfile.targetRoles[0]
        const location = candidateProfile.locations[0]

        if (!targetRole || !location) {
          console.log(`[Cron] User ${userId} missing target role or location. Skipping hunt.`)
          continue
        }

        console.log(`[Cron] Hunting jobs for user ${userId} (${targetRole} in ${location})...`)

        // 2. Trigger Hunter — pass service key as a fake bearer token so the
        //    scoped client inside huntJobs uses the service role client for writes.
        //    The huntJobs handler creates a scoped client from the Authorization header.
        const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || ''
        try {
          const huntRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/hunt-jobs`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`
            },
            body: JSON.stringify({
              searchRole: targetRole,
              location: location,
              candidateProfile,
              userId
            })
          })
          if (!huntRes.ok) {
            console.error(`[Cron] Hunt failed for ${userId}:`, await huntRes.text())
          }
        } catch (e) {
          console.error(`[Cron] Hunt fetch error for ${userId}:`, e)
        }

        // 3. Auto-Apply to high match jobs
        // BUG FIX: Was /api/apply-job → now correctly /api/run-agent (Stagehand)
        console.log(`[Cron] Checking for auto-apply candidates for user ${userId}...`)
        const { data: reviewJobs, error: jobsError } = await serviceClient
          .from('jobs')
          .select('*')
          .eq('user_id', userId)
          .eq('column', 'discovered')
          .gte('match_score', 86) // > 85

        if (jobsError) {
          console.error(`[Cron] Failed to fetch jobs for ${userId}:`, jobsError.message)
          continue
        }

        if (reviewJobs && reviewJobs.length > 0) {
          console.log(`[Cron] Found ${reviewJobs.length} high-match jobs for ${userId}. Initiating auto-apply via Stagehand...`)
          for (const job of reviewJobs) {
            const jobUrl = job.source_url
            if (!jobUrl) continue

            console.log(`[Cron] Auto-applying to job ${job.id} at ${job.company}...`)
            try {
              // BUG FIX: Targets /api/run-agent (Stagehand-powered) not /api/apply-job
              const applyRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/run-agent`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceKey}`
                },
                body: JSON.stringify({
                  jobId: job.id,
                  jobUrl,
                  candidateProfile,
                  userId,
                  jobTitle: job.title,
                  company: job.company
                })
              })

              if (applyRes.ok) {
                const result = await applyRes.json().catch(() => ({}))
                if (result.success) {
                  console.log(`[Cron] ✅ Auto-apply SUCCESS for ${job.id}`)
                } else {
                  console.log(`[Cron] Auto-apply BLOCKED for ${job.id}: ${result.missingField || result.status}`)
                  if (result.missingField) {
                    await serviceClient.from('jobs')
                      .update({ needs_input: true, missing_field: result.missingField })
                      .eq('id', job.id)
                  }
                }
              } else {
                const data = await applyRes.json().catch(() => ({}))
                if (data.status === "NEEDS_INPUT" && data.missingField) {
                  console.log(`[Cron] Auto-apply BLOCKED for ${job.id}: Needs Input (${data.missingField})`)
                  await serviceClient.from('jobs')
                    .update({ needs_input: true, missing_field: data.missingField })
                    .eq('id', job.id)
                } else {
                  console.error(`[Cron] Auto-apply FAILED for ${job.id}:`, data.message || applyRes.statusText)
                }
              }
            } catch (e) {
              console.error(`[Cron] Apply fetch error for ${job.id}:`, e)
            }
          }
        } else {
          console.log(`[Cron] No auto-apply candidates for user ${userId}.`)
        }
      }
      console.log("[Cron] Background job execution cycle complete.")
    } catch (e) {
      console.error("[Cron] Unhandled error in background loop:", e)
    }
  })
}
