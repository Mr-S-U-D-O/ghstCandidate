import { extractJobFromUrl } from '../../utils/jsonLdExtractor.js';
import type { IngestedJob, JobPortalProvider } from '../../types/portal.js';

// ── Lever URL Resolver ────────────────────────────────────────────────────────
//
// Role: URL RESOLVER ONLY (Phase 27.4 scope decision).
//
// Same pattern as the Greenhouse provider. When another provider returns
// a `jobs.lever.co` URL, this resolver extracts the structured JSON-LD
// from that specific posting page.
//
// Native API enumeration (pulling all companies from Lever) is
// deferred to a future phase.

export const leverProvider: JobPortalProvider = {
  name: 'Lever',

  /**
   * As a resolver-only provider, `fetchJobs()` returns an empty array.
   * Resolution happens via `resolveLeverUrl()`.
   */
  async fetchJobs(): Promise<IngestedJob[]> {
    // Resolver-only: no independent feed to poll.
    return [];
  },
};

/**
 * Resolves a single Lever posting URL into a normalized IngestedJob.
 * Call this when any other provider returns a `jobs.lever.co` URL.
 */
export async function resolveLeverUrl(url: string): Promise<IngestedJob | null> {
  if (!url.includes('lever.co') && !url.includes('jobs.lever.co')) {
    return null;
  }

  console.log(`[Lever] Resolving: ${url}`);
  const extracted = await extractJobFromUrl(url);

  if (!extracted.description_html || extracted.description_html.length < 100) {
    console.warn(`[Lever] ⚠️ Insufficient description extracted from: ${url}`);
    return null;
  }

  return {
    title: extracted.title || 'Unknown Title',
    company: extracted.company || 'Unknown Company',
    location: extracted.location || 'Remote',
    description_html: extracted.description_html,
    apply_url: url,
    source: 'Lever',
  };
}
