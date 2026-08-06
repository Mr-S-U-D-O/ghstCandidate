import type { IngestedJob } from '../../types/portal.js';
import { runApifyFleet } from '../apifyRouter.js';

// ── Re-export IngestedJob for backward compatibility ──────────────────────────
// Consumers that previously imported IngestedJob from this file continue to work.
export type { IngestedJob };

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Fetches jobs using the Distributed Key Fleet Architecture on Apify,
 * merging results, and deduplicating by `apply_url`.
 *
 * This function is called by:
 *  - `cron.ts` on the scheduled Harvester cron
 *  - `jobController.ts` `huntJobs` as the live on-demand fallback
 *  - `jobController.ts` `seedHarvester` as a manual admin trigger
 */
export async function ingestFeeds(): Promise<IngestedJob[]> {
  console.log(`[Harvester] Starting distributed Apify ingestion fleet...`);
  
  const allJobs = await runApifyFleet();

  // Deduplicate by apply_url
  const seen = new Set<string>();
  const unique = allJobs.filter(job => {
    if (!job.apply_url || seen.has(job.apply_url)) return false;
    seen.add(job.apply_url);
    return true;
  });

  console.log(`[Harvester] ✅ Ingestion complete: ${allJobs.length} total → ${unique.length} unique jobs.`);
  return unique;
}
