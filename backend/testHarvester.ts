/**
 * Developer Smoke Test — New Zero-Browser JSON-LD Stack
 *
 * Tests the full ingestion pipeline: providers → harvester → extractor
 *
 * Run with:
 *   npx tsx testHarvester.ts
 */

import { ingestFeeds } from './src/utils/cron/harvester.js'
import { extractJobFromUrl } from './src/utils/jsonLdExtractor.js'

async function runHarvesterTest() {
  console.log('=== [Smoke Test] Global Harvester — ingestFeeds() ===\n')
  const jobs = await ingestFeeds()

  if (jobs.length === 0) {
    console.error('❌ No jobs returned. Check provider connectivity.')
    process.exit(1)
  }

  console.log(`\n✅ ${jobs.length} unique jobs ingested.\n`)

  // Sample the first 3 jobs
  const sample = jobs.slice(0, 3)
  for (const job of sample) {
    console.log(`  [${job.source}] "${job.title}" at "${job.company}" (${job.location})`)
    console.log(`  URL: ${job.apply_url}`)
    console.log(`  Description length: ${job.description_html.length} chars`)
    console.log()
  }
}

async function runExtractorTest() {
  const testUrls = [
    // Known JSON-LD source (Greenhouse)
    'https://boards.greenhouse.io/vercel/jobs/5478042',
    // Known RSS-sourced URL
    'https://weworkremotely.com/remote-jobs/openai-senior-software-engineer-inference',
  ]

  console.log('=== [Smoke Test] JSON-LD Extractor — extractJobFromUrl() ===\n')

  for (const url of testUrls) {
    console.log(`Testing: ${url}`)
    try {
      const result = await extractJobFromUrl(url)
      console.log(`  Tier used: ${result.extractionTier}`)
      console.log(`  Title: ${result.title}`)
      console.log(`  Company: ${result.company}`)
      console.log(`  Location: ${result.location}`)
      console.log(`  Description: ${result.description_html?.slice(0, 100)}...`)
    } catch (e: any) {
      console.error(`  ❌ Error: ${e.message}`)
    }
    console.log()
  }
}

(async () => {
  await runExtractorTest()
  await runHarvesterTest()
})()
