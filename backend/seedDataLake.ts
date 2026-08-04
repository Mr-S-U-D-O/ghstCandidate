import { supabase } from "./src/supabaseClient.js"
import { ingestFeeds } from "./src/utils/cron/harvester.js"

async function runManualSeed() {
  console.log("🚀 Starting Manual Data Lake Seed...")
  
  try {
    const jobs = await ingestFeeds()
    console.log(`[Seed] Ingested ${jobs.length} jobs. Upserting into global_jobs...`)

    if (jobs.length === 0) {
      console.log("[Seed] No jobs returned. Exiting.")
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
      console.error("[Seed] ❌ Upsert error:", error.message)
    } else {
      console.log(`[Seed] ✅ Upserted ${data?.length || 0} new jobs into global_jobs Data Lake.`)
    }

  } catch (e) {
    console.error("[Seed] ❌ Unhandled error:", e)
  }
}

runManualSeed().catch(console.error)
