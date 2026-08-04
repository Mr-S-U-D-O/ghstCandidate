import * as cheerio from 'cheerio';
import { resilientFetch } from './resilientFetcher.js';
import type { IngestedJob } from '../types/portal.js';

// ── JSON-LD Extractor ─────────────────────────────────────────────────────────
//
// Zero-browser, high-speed Cheerio utility.
//
// Extraction tier waterfall:
//   Tier 1: <script type="application/ld+json"> — Schema.org JobPosting
//   Tier 2: OpenGraph / Meta tags (og:title, og:description, og:url)
//   Tier 3: Cheerio body text strip (best-effort plain text)
//   Tier 4: Playwright fallback — handled by the CALLER (analyzeJob endpoint only)
//
// This file NEVER launches a browser. Tier 4 is the responsibility of the
// calling code, not this module.

export type ExtractedJob = Partial<IngestedJob> & {
  /** Which tier was used to extract the data */
  extractionTier: 1 | 2 | 3;
};

// ── Tier 1: JSON-LD Schema.org JobPosting ─────────────────────────────────────

function extractJsonLd(html: string, url: string): ExtractedJob | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      // Handle both single object and @graph array
      const candidates: any[] = Array.isArray(parsed)
        ? parsed
        : parsed['@graph']
        ? parsed['@graph']
        : [parsed];

      for (const node of candidates) {
        const type = node['@type'];
        // Accept "JobPosting" or ["JobPosting", ...]
        const isJobPosting =
          type === 'JobPosting' ||
          (Array.isArray(type) && type.includes('JobPosting'));

        if (!isJobPosting) continue;

        // Extract location
        let location = 'Remote';
        if (node.jobLocation) {
          const loc = Array.isArray(node.jobLocation)
            ? node.jobLocation[0]
            : node.jobLocation;
          const addr = loc?.address;
          if (typeof addr === 'string') {
            location = addr;
          } else if (addr?.addressLocality) {
            location = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .filter(Boolean)
              .join(', ');
          } else if (node.applicantLocationRequirements) {
            location = 'Remote';
          }
        }

        // Prefer directApply URL, then url field, then original url
        const applyUrl =
          node.directApply === true
            ? (node.url || url)
            : (node.url || url);

        // Strip HTML from description
        const rawDescription = node.description || '';
        const descriptionText = rawDescription
          ? cheerio.load(rawDescription).text().replace(/\s+/g, ' ').trim()
          : '';

        // Company name
        const hiringOrg = node.hiringOrganization;
        const company =
          typeof hiringOrg === 'string'
            ? hiringOrg
            : hiringOrg?.name || 'Unknown Company';

        return {
          title: node.title || node.name || 'Unknown Title',
          company,
          location,
          description_html: rawDescription || descriptionText,
          apply_url: applyUrl,
          source: 'json-ld',
          extractionTier: 1,
        };
      }
    } catch {
      // Malformed JSON-LD — try next script tag
      continue;
    }
  }

  return null;
}

// ── Tier 2: OpenGraph / Meta Tags ─────────────────────────────────────────────

function extractOpenGraph(html: string, url: string): ExtractedJob | null {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').first().text() ||
    '';

  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  const applyUrl =
    $('meta[property="og:url"]').attr('content') || url;

  if (!title || !description || description.length < 80) return null;

  return {
    title: title.trim(),
    company: 'Unknown Company', // OG tags rarely include company
    location: 'Unknown',
    description_html: description.trim(),
    apply_url: applyUrl,
    source: 'opengraph',
    extractionTier: 2,
  };
}

// ── Tier 3: Body Text Strip ───────────────────────────────────────────────────

function extractBodyText(html: string, url: string): ExtractedJob {
  const $ = cheerio.load(html);

  // Remove noise elements
  $('script, style, nav, footer, header, aside, [role="banner"], [role="navigation"]').remove();

  const title = $('h1').first().text().trim() || 'Unknown Title';

  // Try semantic content containers first
  let bodyText = '';
  const containers = ['main', 'article', '[role="main"]', '.job-description', '#job-description', 'body'];
  for (const sel of containers) {
    const el = $(sel);
    if (el.length) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) {
        bodyText = text;
        break;
      }
    }
  }

  return {
    title,
    company: 'Unknown Company',
    location: 'Unknown',
    description_html: bodyText.slice(0, 8000),
    apply_url: url,
    source: 'body-text',
    extractionTier: 3,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches raw HTML from `url` via `resilientFetch` and extracts job data
 * using the 3-tier waterfall (JSON-LD → OpenGraph → Body Text).
 *
 * Returns a partial IngestedJob. The caller is responsible for implementing
 * Tier-4 (Playwright) if this returns an empty or insufficient description.
 */
export async function extractJobFromUrl(url: string): Promise<ExtractedJob> {
  console.log(`[jsonLdExtractor] Fetching: ${url}`);

  let html: string;
  try {
    html = await resilientFetch(url, { timeoutMs: 5000 });
  } catch (err: any) {
    console.error(`[jsonLdExtractor] ❌ Fetch failed for "${url}":`, err.message);
    return {
      title: 'Unknown Title',
      company: 'Unknown Company',
      location: 'Unknown',
      description_html: '',
      apply_url: url,
      source: 'fetch-error',
      extractionTier: 3,
    };
  }

  // Tier 1 — JSON-LD
  const tier1 = extractJsonLd(html, url);
  if (tier1 && tier1.description_html && tier1.description_html.length > 100) {
    console.log(`[jsonLdExtractor] ✅ Tier 1 (JSON-LD) success for: ${url}`);
    return tier1;
  }

  // Tier 2 — OpenGraph
  const tier2 = extractOpenGraph(html, url);
  if (tier2 && tier2.description_html && tier2.description_html.length > 80) {
    console.log(`[jsonLdExtractor] ✅ Tier 2 (OpenGraph) success for: ${url}`);
    return tier2;
  }

  // Tier 3 — Body Text Strip
  console.log(`[jsonLdExtractor] ⚠️ Falling back to Tier 3 (body text) for: ${url}`);
  return extractBodyText(html, url);
}
