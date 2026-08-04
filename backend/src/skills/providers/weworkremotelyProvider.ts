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

          // P0 Fix: WWR RSS items embed the full job description in the CDATA
          // <content:encoded> field (exposed as item.content by rss-parser).
          // We use this directly to avoid a secondary HTTP fetch per posting,
          // which triggers Cloudflare 403 on ~55% of WWR individual page requests.
          // HTTP resolution via extractJobFromUrl is only used as a fallback when
          // the RSS body is suspiciously short (< 500 chars = truncated snippet).
          const rssContent: string = (item as any).content || item.contentSnippet || '';
          let description = rssContent;
          let company = item.creator || (item as any)['dc:creator'] || 'Unknown Company';
          let location = 'Remote';

          if (rssContent.length < 500) {
            // Thin RSS body — attempt HTTP resolution for richer description
            try {
              const extracted = await extractJobFromUrl(postingUrl);
              if (extracted.description_html && extracted.description_html.length > rssContent.length) {
                description = extracted.description_html;
                if (extracted.company && extracted.company !== 'Unknown Company') company = extracted.company;
                if (extracted.location && extracted.location !== 'Unknown') location = extracted.location;
              }
            } catch {
              // HTTP resolution failed — stick with RSS content
            }
          }

          allJobs.push({
            title: item.title || 'Unknown Title',
            company,
            location,
            description_html: description,
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
