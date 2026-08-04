import { extractJobFromUrl } from '../../utils/jsonLdExtractor.js';
import { ATS_FETCH_OPTIONS } from '../../utils/resilientFetcher.js';
import type { IngestedJob, JobPortalProvider } from '../../types/portal.js';

// ── Greenhouse URL Resolver ───────────────────────────────────────────────────
//
// Role: URL RESOLVER ONLY (Phase 27.4 scope decision).
//
// This provider does NOT enumerate the Greenhouse job board directory.
// It acts as a pass-through resolver: when the harvester receives a
// `boards.greenhouse.io` URL from another provider (e.g., a WeWorkRemotely
// posting that links out to Greenhouse), this resolver extracts the
// structured JSON-LD from that specific posting page.
//
// Native API enumeration (pulling all companies from Greenhouse) is
// deferred to a future phase.

export const greenhouseProvider: JobPortalProvider = {
  name: 'Greenhouse',

  /**
   * As a resolver-only provider, `fetchJobs()` returns an empty array.
   * Resolution happens via `resolveUrl()` which is called externally
   * (e.g., by the harvester or other providers) when they encounter
   * a boards.greenhouse.io URL.
   */
  async fetchJobs(): Promise<IngestedJob[]> {
    // Resolver-only: no independent feed to poll.
    return [];
  },
};

/**
 * Resolves a single Greenhouse posting URL into a normalized IngestedJob.
 * Call this when any other provider returns a `boards.greenhouse.io` URL.
 */
export async function resolveGreenhouseUrl(url: string): Promise<IngestedJob | null> {
  if (!url.includes('greenhouse.io') && !url.includes('boards.greenhouse.io')) {
    return null;
  }

  console.log(`[Greenhouse] Resolving: ${url}`);
  const extracted = await extractJobFromUrl(url, ATS_FETCH_OPTIONS);

  if (!extracted.description_html || extracted.description_html.length < 100) {
    console.warn(`[Greenhouse] ⚠️ Insufficient description extracted from: ${url}`);
    return null;
  }

  return {
    title: extracted.title || 'Unknown Title',
    company: extracted.company || 'Unknown Company',
    location: extracted.location || 'Remote',
    description_html: extracted.description_html,
    apply_url: url,
    source: 'Greenhouse',
  };
}
