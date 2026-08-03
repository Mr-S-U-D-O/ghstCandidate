import Parser from 'rss-parser';
import axios from 'axios';

const parser = new Parser();

// The exact keywords you want to hunt for
const TARGET_KEYWORDS = ['frontend', 'react', 'web developer', 'ui/ux'];

function matchesCriteria(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return TARGET_KEYWORDS.some(kw => text.includes(kw));
}

async function testFeeds() {
  console.log("🚀 Starting Harvester Test Run...\n");
  const qualifiedJobs = [];

  // 1. Test the JSON API (Jobicy)
  try {
    console.log("📡 Fetching Jobicy JSON API...");
    // Fetching engineering jobs with 'frontend' tag
    const jobicyRes = await axios.get('https://jobicy.com/api/v2/remote-jobs?count=20&industry=engineering&tag=frontend');
    const jobs = jobicyRes.data.jobs || [];
    
    for (const job of jobs) {
      if (matchesCriteria(job.jobTitle, job.jobExcerpt || '')) {
        qualifiedJobs.push({
          title: job.jobTitle,
          company: job.companyName,
          apply_url: job.url, // Jobicy's direct ATS URL
          source: 'Jobicy JSON'
        });
      }
    }
    console.log(`✅ Jobicy returned ${jobs.length} jobs. (Qualified: ${qualifiedJobs.length})\n`);
  } catch (error: any) {
    console.error("❌ Jobicy failed:", error.message);
  }

  // 2. Test the XML RSS Feed (WeWorkRemotely)
  try {
    console.log("📡 Fetching WeWorkRemotely XML RSS...");
    const wwrFeed = await parser.parseURL('https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss');
    
    let wwrQualified = 0;
    for (const item of wwrFeed.items) {
      if (matchesCriteria(item.title || '', item.contentSnippet || '')) {
        qualifiedJobs.push({
          title: item.title,
          company: item.creator || 'Unknown',
          apply_url: item.link, 
          source: 'WeWorkRemotely RSS'
        });
        wwrQualified++;
      }
    }
    console.log(`✅ WWR returned ${wwrFeed.items.length} jobs. (Qualified: ${wwrQualified})\n`);
  } catch (error: any) {
    console.error("❌ WeWorkRemotely failed:", error.message);
  }

  // 3. The Result
  console.log("==========================================");
  console.log(`🎯 TOTAL QUALIFIED JOBS FOUND: ${qualifiedJobs.length}`);
  console.log("==========================================\n");
  
  if (qualifiedJobs.length > 0) {
    console.log("Sample of what will be inserted into the Data Lake:");
    console.dir(qualifiedJobs.slice(0, 3), { depth: null, colors: true });
  } else {
    console.log("No jobs matched your criteria today.");
  }
}

testFeeds();
