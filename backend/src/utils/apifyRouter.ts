import { ApifyClient } from 'apify-client';
import type { IngestedJob } from '../types/portal.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { emitFleetLog } from './fleetLogger.js';

const ACTORS = [
  'fantastic-jobs/ashby-jobs-api',
  'fantastic-jobs/greenhouse-jobs-api',
  'fantastic-jobs/lever-co-jobs-api'
];

export async function runApifyFleet(): Promise<IngestedJob[]> {
  const allJobs: IngestedJob[] = [];

  // Fetch active configurations from the database
  const { data: activeConfigs, error } = await supabaseAdmin
    .from('apify_fleet_configs')
    .select('*')
    .eq('is_active', true);

  if (error) {
    emitFleetLog(`[ApifyFleet] ❌ Failed to fetch fleet configs from database: ${error.message}`);
    return [];
  }

  if (!activeConfigs || activeConfigs.length === 0) {
    emitFleetLog(`[ApifyFleet] ⚠️ No active fleet configurations found in database.`);
    return [];
  }

  for (const config of activeConfigs) {
    if (!config.api_key) {
      emitFleetLog(`[ApifyFleet] ⚠️ Missing API key for niche: ${config.niche_name}. Skipping.`);
      continue;
    }

    emitFleetLog(`[ApifyFleet] 🚀 Starting ${config.niche_name} niche scraping with ${ACTORS.length} actors...`);
    const client = new ApifyClient({ token: config.api_key });

    for (const actorId of ACTORS) {
      emitFleetLog(`[ApifyFleet] → Calling ${actorId} for ${config.niche_name}...`);
      try {
        const safeLimit = Math.max(200, config.max_items_per_actor || 200);
        
        const run = await client.actor(actorId).call({
          queries: Array.isArray(config.search_queries) ? config.search_queries.join('\n') : '',
          limit: safeLimit,
          maxItems: safeLimit,
        });

        emitFleetLog(`[ApifyFleet] ✅ Actor ${actorId} finished. Fetching dataset...`);
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        emitFleetLog(`[ApifyFleet] 📥 Fetched ${items.length} items from ${actorId} for ${config.niche_name}.`);
        
        // Map raw Apify output to IngestedJob schema
        const mappedJobs = items.map((job: any) => {
          // Parse the complex locations_derived array to a clean string
          let locationString = 'Remote';
          if (job.locations_derived && job.locations_derived.length > 0) {
            const loc = job.locations_derived[0];
            // Filters out nulls and joins neatly (e.g. "San Francisco, California, United States")
            locationString = [loc.city, loc.admin, loc.country].filter(Boolean).join(', ');
          }

          return {
            title: job.title || 'Unknown Title',
            company: job.organization || 'Unknown Company',
            location: locationString,
            description_html: job.description_html || job.description_text || '',
            apply_url: job.url || '',
            source: actorId, // Kept as 'source' to match IngestedJob interface
            ats_id: job.id ? String(job.id) : null
          } as IngestedJob;
        }).filter((job: any) => job.description_html !== '' && job.apply_url !== '');

        allJobs.push(...mappedJobs);
      } catch (e: any) {
        emitFleetLog(`[ApifyFleet] ❌ Error running ${actorId} for ${config.niche_name}: ${e.message}`);
      }
    }

    // Update last_run_at timestamp
    await supabaseAdmin
      .from('apify_fleet_configs')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', config.id);
  }

  return allJobs;
}
