// ── Shared Job Portal Types ────────────────────────────────────────────────
// This is the canonical type definition for all job ingestion in ghstCandidate.
// All provider files and the harvester import from here.

/**
 * The normalized job payload that every provider returns.
 * This is the contract between providers and the harvester.
 */
export interface IngestedJob {
  title: string;
  company: string;
  location: string;
  description_html: string;
  apply_url: string;
  source: string;
}

