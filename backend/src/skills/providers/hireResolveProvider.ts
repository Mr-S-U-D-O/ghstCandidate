import Parser from 'rss-parser';
import { extractJobFromUrl } from '../../utils/jsonLdExtractor.js';
import type { IngestedJob, JobPortalProvider } from '../../types/portal.js';

// ── HireResolve South Africa Provider ────────────────────────────────────────
//
// Source: HireResolve RSS feed (Johannesburg region)
// Type: RSS/XML
//
// Like WWR, RSS bodies are snippets. We resolve each posting URL through
// extractJobFromUrl() for the full description.

const FEEDS = [
  'https://hireresolve.co.za/job-region/johannesburg/feed/',
  'https://hireresolve.co.za/job-category/it/feed/',
];

const rssParser = new Parser();

export const hireResolveProvider: JobPortalProvider = {
  name: 'HireResolveSA',

  async fetchJobs(): Promise<IngestedJob[]> {
    console.log(`[${this.name}] Fetching ${FEEDS.length} RSS feeds...`);
    const allJobs: IngestedJob[] = [];

    for (const feedUrl of FEEDS) {
      try {
        const feed = await rssParser.parseURL(feedUrl);

        for (const item of feed.items) {
          const postingUrl = item.link || '';
          if (!postingUrl) continue;

          const extracted = await extractJobFromUrl(postingUrl);

          allJobs.push({
            title: item.title || extracted.title || 'Unknown Title',
            company: item.creator || item['dc:creator'] || extracted.company || 'Unknown Company',
            location: extracted.location || 'Johannesburg, South Africa',
            description_html: extracted.description_html || item.contentSnippet || '',
            apply_url: postingUrl,
            source: this.name,
          });
        }
      } catch (e: any) {
        console.error(`[${this.name}] ❌ Feed error (${feedUrl}):`, e.message);
      }
    }

    console.log(`[${this.name}] ✅ Fetched ${allJobs.length} jobs.`);
    return allJobs;
  },
};
