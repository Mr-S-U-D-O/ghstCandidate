import axios from 'axios';

export interface NormalizedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  api_source: string;
}

export async function fetchFromJSearch(searchRole: string, location: string): Promise<NormalizedJob[]> {
  const query = `${searchRole} in ${location}`;
  console.log(`[jobAdapter] 📡 Calling JSearch API for: "${query}"`);
  
  try {
    const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
      headers: {
        'x-rapidapi-key': process.env.JSEARCH_RAPIDAPI_KEY,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com'
      },
      params: {
        query: query,
        page: '1',
        num_pages: '1'
      }
    });

    const data = response.data?.data;
    console.log(`[jobAdapter] ✅ JSearch returned HTTP ${response.status}. Payload data length: ${data ? data.length : 0}`);
    if (!data || !Array.isArray(data)) {
      console.warn(`[jobAdapter] ⚠️ JSearch returned empty or invalid data array. Proceeding to fallback.`);
      return [];
    }

    return data.map((job: any) => ({
      title: job.job_title || 'Unknown Title',
      company: job.employer_name || 'Unknown Company',
      location: job.job_city ? (job.job_country ? `${job.job_city}, ${job.job_country}` : job.job_city) : (job.job_country || 'Remote/Unknown'),
      description: job.job_description || '',
      apply_url: job.job_apply_link || job.job_google_link || '',
      api_source: 'jsearch'
    })).filter((job: NormalizedJob) => job.apply_url);
  } catch (error: any) {
    console.error(`[jobAdapter] ❌ Error fetching from JSearch. Status: ${error.response?.status || 'N/A'}. Reason: ${error.message}`);
    return [];
  }
}

export async function fetchFromReed(searchRole: string, location: string): Promise<NormalizedJob[]> {
  console.log(`[jobAdapter] 📡 Calling Reed API for: "${searchRole}" in "${location}"`);
  try {
    const response = await axios.get('https://www.reed.co.uk/api/1.0/search', {
      params: {
        keywords: searchRole,
        locationName: location
      },
      auth: {
        username: process.env.REED_API_KEY as string,
        password: ''
      }
    });

    const data = response.data?.results;
    console.log(`[jobAdapter] ✅ Reed returned HTTP ${response.status}. Results count: ${data ? data.length : 0}`);
    if (!data || !Array.isArray(data)) {
      console.warn(`[jobAdapter] ⚠️ Reed returned empty or invalid results array. Proceeding to fallback.`);
      return [];
    }

    return data.map((job: any) => ({
      title: job.jobTitle || 'Unknown Title',
      company: job.employerName || 'Unknown Company',
      location: job.locationName || 'Remote/Unknown',
      description: job.jobDescription || '',
      apply_url: job.jobUrl || '',
      api_source: 'reed'
    })).filter((job: NormalizedJob) => job.apply_url);
  } catch (error: any) {
    console.error(`[jobAdapter] ❌ Error fetching from Reed. Status: ${error.response?.status || 'N/A'}. Reason: ${error.message}`);
    return [];
  }
}

export async function fetchFromTheirstack(searchRole: string, location: string): Promise<NormalizedJob[]> {
  console.log(`[jobAdapter] 📡 Calling TheirStack API for: "${searchRole}" (location limit ignored)`);
  try {
    const response = await axios.post('https://api.theirstack.com/v1/jobs/search', {
      job_title_or: [searchRole],
      posted_at_max_age_days: 30,
      limit: 10
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.THEIRSTACK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data?.data;
    console.log(`[jobAdapter] ✅ TheirStack returned HTTP ${response.status}. Data count: ${data ? data.length : 0}`);
    if (!data || !Array.isArray(data)) {
      console.warn(`[jobAdapter] ⚠️ TheirStack returned empty or invalid data array. Proceeding to fallback.`);
      return [];
    }

    return data.map((job: any) => ({
      title: job.job_title || job.title || 'Unknown Title',
      company: job.company_name || job.company || 'Unknown Company',
      location: job.location || 'Remote/Unknown',
      description: job.description || '',
      apply_url: job.url || job.apply_url || '',
      api_source: 'theirstack'
    })).filter((job: NormalizedJob) => job.apply_url);
  } catch (error: any) {
    console.error(`[jobAdapter] ❌ Error fetching from TheirStack. Status: ${error.response?.status || 'N/A'}. Reason: ${error.message}`);
    return [];
  }
}

export async function fetchFromIndeed(searchRole: string, location: string): Promise<NormalizedJob[]> {
  console.log(`[jobAdapter] 📡 Calling Indeed API for: "${searchRole}" in "${location}"`);
  try {
    const response = await axios.post('https://indeed-scraper-api.p.rapidapi.com/api/job', {
      scraper: {
        query: searchRole,
        location: location,
        maxRows: 10,
        country: location.toLowerCase().includes('south africa') ? 'za' : 'us'
      }
    }, {
      headers: {
        'x-rapidapi-key': process.env.INDEED_RAPIDAPI_KEY,
        'x-rapidapi-host': process.env.INDEED_RAPIDAPI_HOST,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    console.log(`[jobAdapter] ✅ Indeed returned HTTP ${response.status}. Data length: ${Array.isArray(data) ? data.length : 0}`);
    if (!data || !Array.isArray(data)) {
      console.warn(`[jobAdapter] ⚠️ Indeed returned empty or invalid data array. Proceeding to fallback.`);
      return [];
    }

    return data.map((job: any) => ({
      title: job.title || 'Unknown Title',
      company: job.companyName || 'Unknown Company',
      location: job.location?.formattedAddressShort || location,
      description: job.descriptionText || '',
      apply_url: job.applyUrl || job.jobUrl || '',
      api_source: 'indeed'
    })).filter((job: NormalizedJob) => job.apply_url);
  } catch (error: any) {
    console.error(`[jobAdapter] ❌ Error fetching from Indeed. Status: ${error.response?.status || 'N/A'}. Reason: ${error.message}`);
    return [];
  }
}
