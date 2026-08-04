import axios from 'axios';
import Parser from 'rss-parser';

export interface IngestedJob {
  title: string;
  company: string;
  location: string;
  description_html: string;
  apply_url: string;
  source: string;
}

const FEED_SOURCES = [
  // Jobicy API (Highly structured remote JSON)
  { name: 'Jobicy', type: 'json', url: 'https://jobicy.com/api/v2/remote-jobs?count=100&industry=engineering&tag=frontend' },
  // WeWorkRemotely (Full HTML CDATA XML)
  { name: 'WeWorkRemotely', type: 'rss', url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss' },
  // RemoteOK (JSON API)
  { name: 'RemoteOK', type: 'json', url: 'https://remoteok.com/api?tag=frontend' },
  // Hire Resolve South Africa (Johannesburg Regional RSS)
  { name: 'HireResolveSA', type: 'rss', url: 'https://hireresolve.co.za/job-region/johannesburg/feed/' }
];

const rssParser = new Parser();

export async function ingestFeeds(): Promise<IngestedJob[]> {
  const allJobs: IngestedJob[] = [];

  for (const source of FEED_SOURCES) {
    console.log(`[Harvester] Fetching from ${source.name}...`);
    try {
      if (source.type === 'json') {
        const res = await axios.get(source.url, { timeout: 30000 });
        if (source.name === 'Jobicy') {
          const jobs = res.data.jobs || [];
          for (const j of jobs) {
            allJobs.push({
              title: j.jobTitle || '',
              company: j.companyName || 'Unknown Company',
              location: j.jobGeo || 'Remote',
              description_html: j.jobDescription || '',
              apply_url: j.url || '',
              source: source.name
            });
          }
        } else if (source.name === 'RemoteOK') {
          const jobs = res.data || [];
          for (const j of jobs) {
            if (j.legal === 'API') continue;
            allJobs.push({
              title: j.position || '',
              company: j.company || 'Unknown Company',
              location: j.location || 'Remote',
              description_html: j.description || '',
              apply_url: j.apply_url || j.url || '',
              source: source.name
            });
          }
        }
      } else if (source.type === 'rss') {
        const feed = await rssParser.parseURL(source.url);
        for (const item of feed.items) {
          allJobs.push({
            title: item.title || '',
            company: item.creator || item['dc:creator'] || 'Unknown Company',
            location: source.name === 'HireResolveSA' ? 'Johannesburg, South Africa' : 'Remote',
            description_html: item.content || item.contentSnippet || '',
            apply_url: item.link || '',
            source: source.name
          });
        }
      }
    } catch (e: any) {
      console.error(`[Harvester] ❌ Error fetching from ${source.name}:`, e.message);
    }
  }

  // Deduplicate by apply_url
  const seen = new Set<string>();
  const unique = allJobs.filter(job => {
    if (!job.apply_url || seen.has(job.apply_url)) return false;
    seen.add(job.apply_url);
    return true;
  });

  console.log(`[Harvester] Ingested ${unique.length} unique jobs.`);
  return unique;
}
