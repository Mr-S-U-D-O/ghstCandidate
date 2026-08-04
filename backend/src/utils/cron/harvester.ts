import type { IngestedJob, JobPortalProvider } from '../../types/portal.js';
import { jobicyProvider } from '../../skills/providers/jobicyProvider.js';
import { weworkremotelyProvider } from '../../skills/providers/weworkremotelyProvider.js';
import { hireResolveProvider } from '../../skills/providers/hireResolveProvider.js';

// ── Re-export IngestedJob for backward compatibility ──────────────────────────
// Consumers that previously imported IngestedJob from this file continue to work.
export type { IngestedJob };

// ── Registered Providers ──────────────────────────────────────────────────────
//
// To add a new job source: create a file in `backend/src/skills/providers/`,
// implement the JobPortalProvider interface, and add the instance here.
// Zero changes required to the harvester logic below.
//
// Note: Greenhouse and Lever are resolver-only providers (Phase 27.4 scope).
// They are called automatically by other providers when their URLs appear in
// feed results. They do not need to be registered here as polling sources.

const PROVIDERS: JobPortalProvider[] = [
  jobicyProvider,
  weworkremotelyProvider,
  hireResolveProvider,
];

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Fetches jobs from all registered providers, merges results, and
 * deduplicates by `apply_url`.
 *
 * This function is called by:
 *  - `cron.ts` on the scheduled Harvester cron
 *  - `jobController.ts` `huntJobs` as the live on-demand fallback
 *  - `jobController.ts` `seedHarvester` as a manual admin trigger
 */
export async function ingestFeeds(): Promise<IngestedJob[]> {
  console.log(`[Harvester] Starting ingestion across ${PROVIDERS.length} providers...`);
  const allJobs: IngestedJob[] = [];

  for (const provider of PROVIDERS) {
    console.log(`[Harvester] → Fetching from: ${provider.name}`);
    try {
      const jobs = await provider.fetchJobs();
      allJobs.push(...jobs);
      console.log(`[Harvester] ✅ ${provider.name}: ${jobs.length} jobs ingested.`);
    } catch (e: any) {
      console.error(`[Harvester] ❌ ${provider.name} failed:`, e.message);
    }
  }

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
