import axios from 'axios';
import type { IngestedJob, JobPortalProvider } from '../../types/portal.js';

// ── Jobicy Provider ───────────────────────────────────────────────────────────
//
// Source: https://jobicy.com/api/v2/remote-jobs
// Type: Structured JSON API
// Note: The API is multi-industry and multi-role. We do NOT hardcode a tag
// or industry here — the provider fetches a broad set and the harvester /
// huntJobs filtering handles role/location matching.

interface JobicyJob {
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobDescription?: string;
  url?: string;
}

interface JobicyResponse {
  jobs?: JobicyJob[];
}

export const jobicyProvider: JobPortalProvider = {
  name: 'Jobicy',

  async fetchJobs(): Promise<IngestedJob[]> {
    const url = 'https://jobicy.com/api/v2/remote-jobs?count=100';
    console.log(`[${this.name}] Fetching from ${url}...`);

    try {
      const res = await axios.get<JobicyResponse>(url, { timeout: 30000 });
      const jobs: JobicyJob[] = res.data.jobs || [];

      const results: IngestedJob[] = jobs
        .filter(j => j.url && j.jobDescription)
        .map(j => ({
          title: j.jobTitle || 'Unknown Title',
          company: j.companyName || 'Unknown Company',
          location: j.jobGeo || 'Remote',
          description_html: j.jobDescription || '',
          apply_url: j.url || '',
          source: this.name,
        }));

      console.log(`[${this.name}] ✅ Fetched ${results.length} jobs.`);
      return results;
    } catch (e: any) {
      console.error(`[${this.name}] ❌ Error:`, e.message);
      return [];
    }
  },
};
