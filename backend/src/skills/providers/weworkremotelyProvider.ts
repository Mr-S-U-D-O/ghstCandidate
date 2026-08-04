import Parser from 'rss-parser';
import { extractJobFromUrl } from '../../utils/jsonLdExtractor.js';
import type { IngestedJob, JobPortalProvider } from '../../types/portal.js';

// ── WeWorkRemotely Provider ───────────────────────────────────────────────────
//
// Source: WeWorkRemotely RSS feeds
// Type: RSS/XML with CDATA-wrapped HTML snippets
//
// IMPORTANT: RSS item bodies from WWR are truncated content snippets,
// NOT the full job description. For each RSS item we resolve the actual
// posting URL via extractJobFromUrl() to get the real description.
// This is slower but ensures DeepSeek receives a complete JD.

const FEEDS = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
  'https://weworkremotely.com/categories/remote-design-jobs.rss',
];

const rssParser = new Parser();

export const weworkremotelyProvider: JobPortalProvider = {
  name: 'WeWorkRemotely',

  async fetchJobs(): Promise<IngestedJob[]> {
    console.log(`[${this.name}] Fetching ${FEEDS.length} RSS feeds...`);
    const allJobs: IngestedJob[] = [];

    for (const feedUrl of FEEDS) {
      try {
        const feed = await rssParser.parseURL(feedUrl);

        for (const item of feed.items) {
          const postingUrl = item.link || '';
          if (!postingUrl) continue;

          // Resolve the actual posting for the full description
          const extracted = await extractJobFromUrl(postingUrl);

          allJobs.push({
            title: item.title || extracted.title || 'Unknown Title',
            company: item.creator || item['dc:creator'] || extracted.company || 'Unknown Company',
            location: extracted.location || 'Remote',
            description_html: extracted.description_html || item.contentSnippet || '',
            apply_url: postingUrl,
            source: this.name,
          });
        }
      } catch (e: any) {
        console.error(`[${this.name}] ❌ Feed error (${feedUrl}):`, e.message);
      }
    }

    console.log(`[${this.name}] ✅ Fetched ${allJobs.length} jobs across all feeds.`);
    return allJobs;
  },
};
