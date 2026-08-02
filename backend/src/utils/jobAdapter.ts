import axios from 'axios';

export interface NormalizedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  api_source: string;
  ats_id?: string;
}

// ── Apify Actor IDs ─────────────────────────────────────────────────
const APIFY_ACTORS = {
  greenhouse: 'fantastic-jobs~greenhouse-jobs-api',
  lever: 'fantastic-jobs~lever-co-jobs-api',
  ashby: 'fantastic-jobs~ashby-jobs-api',
} as const;

// Default search terms to ensure the scrapers return tech roles during harvesting
const DEFAULT_SEARCH_TERMS = ['Web Developer', 'Frontend', 'Backend', 'Fullstack', 'Software Engineer', 'Engineer'];

// ── Apify Runner ────────────────────────────────────────────────────
// Calls the Apify actor synchronously and returns the raw dataset items.

async function runApifyActor(actorId: string, input: Record<string, unknown>, limit: number): Promise<any[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error(`[jobAdapter] ❌ APIFY_TOKEN is not set. Cannot call ${actorId}.`);
    return [];
  }

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
  console.log(`[jobAdapter] 📡 Calling Apify actor: ${actorId} (limit: ${limit})`);

  try {
    const response = await axios.post(url, { ...input, maxItems: limit }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120_000, // 2 minute timeout for sync runs
    });

    const data = response.data;
    if (!Array.isArray(data)) {
      console.warn(`[jobAdapter] ⚠️ ${actorId} returned non-array response. Type: ${typeof data}`);
      return [];
    }

    console.log(`[jobAdapter] ✅ ${actorId} returned ${data.length} items.`);
    return data;
  } catch (error: any) {
    console.error(`[jobAdapter] ❌ Error calling ${actorId}. Status: ${error.response?.status || 'N/A'}. Reason: ${error.message}`);
    return [];
  }
}

// ── Greenhouse Fetcher ──────────────────────────────────────────────

export async function fetchFromGreenhouse(limit: number): Promise<NormalizedJob[]> {
  const raw = await runApifyActor(APIFY_ACTORS.greenhouse, { searchTerms: DEFAULT_SEARCH_TERMS }, limit);

  return raw.map((job: any) => ({
    title: job.title || 'Unknown Title',
    company: job.organization || job.company || job.companySlug || 'Unknown Company',
    location: job.locations_derived?.[0] || job.location_type || job.location?.name || 'Remote/Unknown',
    description: job.description_text || job.description_html || job.contentText || '',
    apply_url: job.url || job.absoluteUrl || job.applyUrl || '',
    api_source: 'greenhouse',
    ats_id: job.id ? String(job.id) : undefined,
  })).filter((job: NormalizedJob) => job.apply_url && job.description);
}

// ── Lever Fetcher ───────────────────────────────────────────────────

export async function fetchFromLever(limit: number): Promise<NormalizedJob[]> {
  const raw = await runApifyActor(APIFY_ACTORS.lever, { searchTerms: DEFAULT_SEARCH_TERMS }, limit);

  return raw.map((job: any) => ({
    title: job.title || job.text || 'Unknown Title',
    company: job.organization || job.company || job.companySlug || 'Unknown Company',
    location: job.locations_derived?.[0] || job.location_type || job.categories?.location || job.location || 'Remote/Unknown',
    description: job.description_text || job.description_html || job.descriptionPlain || '',
    apply_url: job.url || job.hostedUrl || job.applyUrl || '',
    api_source: 'lever',
    ats_id: job.id ? String(job.id) : undefined,
  })).filter((job: NormalizedJob) => job.apply_url && job.description);
}

// ── Ashby Fetcher ───────────────────────────────────────────────────

export async function fetchFromAshby(limit: number): Promise<NormalizedJob[]> {
  const raw = await runApifyActor(APIFY_ACTORS.ashby, { searchTerms: DEFAULT_SEARCH_TERMS }, limit);

  return raw.map((job: any) => ({
    title: job.title || 'Unknown Title',
    company: job.organization || job.company || job.organizationName || 'Unknown Company',
    location: job.locations_derived?.[0] || job.location_type || job.location || 'Remote/Unknown',
    description: job.description_text || job.description_html || job.description || '',
    apply_url: job.url || job.applyUrl || '',
    api_source: 'ashby',
    ats_id: job.id ? String(job.id) : undefined,
  })).filter((job: NormalizedJob) => job.apply_url && job.description);
}

// ── Composite Harvester ─────────────────────────────────────────────
// Splits the total limit across all 3 sources, runs in parallel,
// merges, and deduplicates by apply_url.

export async function harvestAllSources(totalLimit: number): Promise<NormalizedJob[]> {
  const perSource = Math.ceil(totalLimit / 3);

  // Apify actors have a hardcoded minimum of ~200 items per run regardless of maxItems.
  // Log a warning so we know we're going to receive more than requested.
  if (totalLimit < 600) {
    console.warn(`[jobAdapter] ⚠️ Requested ${totalLimit} jobs but Apify minimum is ~200/actor (600 total). All returned jobs will be kept — we never discard what we pay for.`);
  }

  console.log(`[jobAdapter] 🌾 Starting harvest: ${totalLimit} requested (${perSource} per source)...`);

  const results = await Promise.allSettled([
    fetchFromGreenhouse(perSource),
    fetchFromLever(perSource),
    fetchFromAshby(perSource),
  ]);

  const allJobs: NormalizedJob[] = [];
  const sourceNames = ['Greenhouse', 'Lever', 'Ashby'];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`[jobAdapter] ✅ ${sourceNames[i]}: ${result.value.length} jobs harvested.`);
      allJobs.push(...result.value);
    } else {
      console.error(`[jobAdapter] ❌ ${sourceNames[i]} failed:`, result.reason);
    }
  });

  // Deduplicate by apply_url
  const seen = new Set<string>();
  const unique = allJobs.filter(job => {
    if (seen.has(job.apply_url)) return false;
    seen.add(job.apply_url);
    return true;
  });

  console.log(`[jobAdapter] 🌾 Harvest complete: ${allJobs.length} total → ${unique.length} unique jobs.`);
  return unique; // NEVER slice. We keep everything we pay for.
}
