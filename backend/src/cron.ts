import cron from "node-cron"
import { supabase } from "./supabaseClient.js"

export function initCron() {
  console.log("[Cron] Initializing 24/7 Background Loop...")
  
  // Run every 4 hours: "0 */4 * * *"
  cron.schedule("0 */4 * * *", async () => {
    console.log("[Cron] Starting background job execution cycle...")
    
    try {
      // 1. Fetch all profiles
      const { data: profiles, error } = await supabase.from('profiles').select('*')
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
        // 2. Trigger Hunter
        try {
          const huntRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/hunt-jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        console.log(`[Cron] Checking for auto-apply candidates for user ${userId}...`)
        const { data: reviewJobs, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .eq('user_id', userId)
          .eq('column', 'review')
          .gte('match_score', 86) // > 85

        if (jobsError) {
          console.error(`[Cron] Failed to fetch jobs for ${userId}:`, jobsError.message)
          continue
        }

        if (reviewJobs && reviewJobs.length > 0) {
          console.log(`[Cron] Found ${reviewJobs.length} high-match jobs for ${userId}. Initiating auto-apply...`)
          for (const job of reviewJobs) {
             const jobUrl = job.source_url
             if (!jobUrl) continue

             console.log(`[Cron] Auto-applying to job ${job.id} at ${job.company}...`)
             try {
                const applyRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/apply-job`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    jobUrl,
                    candidateProfile
                  })
                })
                
                if (applyRes.ok) {
                  // Success! Update DB
                  await supabase.from('jobs').update({ column: 'applied' }).eq('id', job.id)
                  console.log(`[Cron] Auto-apply SUCCESS for ${job.id}`)
                } else {
                  const data = await applyRes.json().catch(() => ({}))
                  if (data.status === "NEEDS_INPUT" && data.missingField) {
                     console.log(`[Cron] Auto-apply BLOCKED for ${job.id}: Needs Input (${data.missingField})`)
                     await supabase.from('jobs').update({ needs_input: true, missing_field: data.missingField }).eq('id', job.id)
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
