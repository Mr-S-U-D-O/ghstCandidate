import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)

async function checkJobs() {
  const { data } = await supabase
    .from('global_jobs')
    .select('id, title, location, company')

  if (data && data.length > 0) {
    const devRemote = data.filter(j => 
      j.title && j.title.toLowerCase().includes('dev') && 
      j.location && j.location.toLowerCase().includes('remote')
    )
    console.log(`Jobs with BOTH "dev" in title AND "remote" in location: ${devRemote.length}`)
    console.table(devRemote)
    
    // Check for the "Sr. Full Stack Developer at Element Solutions" job
    const elementSolutions = data.filter(j => j.company && j.company.includes('Element Solutions'))
    console.log(`\nJobs at Element Solutions: ${elementSolutions.length}`)
    console.table(elementSolutions)
  }
}

checkJobs()
