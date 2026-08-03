import { ingestFeeds } from './src/utils/cron/harvester.js';

async function testHarvester() {
  console.log('Testing Harvester...');
  const jobs = await ingestFeeds();
  console.log(`Ingested ${jobs.length} jobs.`);
  console.log(jobs.slice(0, 2));
}

testHarvester().catch(console.error);
