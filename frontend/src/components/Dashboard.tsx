import React, { useState, useEffect, useContext } from "react"
import MatchReportPanel from "./MatchReportPanel"
import GhostChat from "./GhostChat"
import { UserContext } from "../context/UserContext"
import { supabase } from "../supabaseClient"
import {
  LayoutDashboard,
  FileText,
  Settings,
  Search,
  Play,
  ChevronRight,
  Check,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Bot
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────

type ColumnId = "discovered" | "review" | "applied"

export interface Job {
  id: string
  company: string
  title: string
  location: string
  postedAgo: string
  matchScore: number
  column: ColumnId
  // Live AI data from Gemini
  verdict: string
  matchesFound: string[]
  missingOrWeak: string[]
  humanInputRequired: string[]
  sourceUrl?: string
  // Phase 11: execution status
  needsInput?: boolean
  missingField?: string
}


// ── Columns config ────────────────────────────────────────────────

const COLUMNS: { id: ColumnId; label: string; description: string }[] = [
  { id: "discovered", label: "Discovered", description: "Raw scraped jobs" },
  { id: "review", label: "Review", description: "Awaiting your approval" },
  { id: "applied", label: "Applied", description: "Handled by your Ghost" },
]

// ── Match Badge ───────────────────────────────────────────────────

function MatchBadge({ score, needsInput, missingField }: { score: number; needsInput?: boolean; missingField?: string }) {
  if (needsInput && missingField) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium font-sans bg-amber-50 text-amber-700 border border-amber-200">
        ⚠ Needs Input: {missingField}
      </span>
    )
  }
  if (score >= 85) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium font-sans bg-green-50 text-green-800 border border-green-100">
        {score}% Match
      </span>
    )
  }
  if (score >= 70) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium font-sans bg-amber-50 text-amber-700 border border-amber-100">
        {score}% — Needs Input
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium font-sans bg-gray-100 text-gray-500 border border-gray-200">
      {score}% Match
    </span>
  )
}

// ── Job Card ──────────────────────────────────────────────────────

interface JobCardProps {
  job: Job
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onSelect?: (job: Job) => void
}

function JobCard({ job, onApprove, onReject, onSelect }: JobCardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer group"
      style={{ boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s ease" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        console.log(`[Dashboard] JobCard clicked: ${job.title} at ${job.company} (ID: ${job.id})`)
        onSelect?.(job)
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="font-heading font-bold text-sm text-[#0A0A0A] leading-tight">{job.company}</span>
        <span className="flex items-center gap-1 text-xs text-gray-400 font-sans shrink-0 ml-2">
          <Clock size={11} strokeWidth={1.5} />
          {job.postedAgo}
        </span>
      </div>
      <p className="font-sans text-sm text-gray-700 leading-snug mb-1">{job.title}</p>
      <p className="font-sans text-xs text-gray-400 mb-4">{job.location}</p>
      <div className="flex items-center justify-between">
        <MatchBadge score={job.matchScore} needsInput={job.needsInput} missingField={job.missingField} />
        {job.column === "review" && onApprove && onReject && (
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onApprove(job.id) }} className="flex items-center gap-1 px-3 py-1.5 bg-[#0A0A0A] text-white text-xs font-sans font-medium rounded-sm hover:bg-gray-800 transition-colors">
              <Check size={11} strokeWidth={2.5} />Approve
            </button>
            <button onClick={(e) => { e.stopPropagation(); onReject(job.id) }} className="flex items-center gap-1 px-3 py-1.5 bg-white text-gray-500 text-xs font-sans font-medium rounded-sm border border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-colors">
              <X size={11} strokeWidth={2.5} />Reject
            </button>
          </div>
        )}
        {job.column === "applied" && (
          <span className="flex items-center gap-1 text-xs font-sans text-green-700"><Check size={11} strokeWidth={2.5} />Submitted</span>
        )}
        {job.column === "discovered" && (
          <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
        )}
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────

type NavPage = "dashboard" | "chat" | "resumes" | "settings"

const NAV_ITEMS: { id: NavPage; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard", label: "Job Tracker", Icon: LayoutDashboard },
  { id: "chat", label: "Ghost Profiler", Icon: Bot },
  { id: "resumes", label: "Resumes", Icon: FileText },
  { id: "settings", label: "Ghost Settings", Icon: Settings },
]

function Sidebar({ activePage, onNavigate, ghostPulse }: { activePage: NavPage; onNavigate: (p: NavPage) => void; ghostPulse?: boolean }) {
  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200" style={{ width: "250px", minWidth: "250px" }}>
      <div className="p-6 border-b border-gray-100 flex items-center gap-1">
        <img src="/logo-transparent.png" alt="ghstCandidate Logo" className="h-8 w-auto -mr-1.5" />
        <span className="font-heading font-bold text-xl text-[#0A0A0A] tracking-tight">ghstCandidate</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activePage === id
          const isPulse = id === 'chat' && ghostPulse && !isActive
          return (
            <button key={id} onClick={() => onNavigate(id)} className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-colors text-left ${isActive ? "bg-gray-100 text-[#0A0A0A]" : "text-gray-500 hover:text-[#0A0A0A] hover:bg-gray-50"}`}>
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} className={isActive ? "text-[#0A0A0A]" : "text-gray-400"} />
              {label}
              {isPulse && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </button>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
            <span className="font-sans font-bold text-xs text-white">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans font-medium text-xs text-[#0A0A0A] truncate">Jane Doe</p>
            <p className="font-sans text-xs text-gray-400">Free tier</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────

function KanbanColumn({ column, jobs, onApprove, onReject, onSelect }: {
  column: typeof COLUMNS[number]
  jobs: Job[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onSelect: (job: Job) => void
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-sans text-xs font-semibold uppercase tracking-widest text-gray-400">{column.label}</span>
          <p className="font-sans text-xs text-gray-300 mt-0.5">{column.description}</p>
        </div>
        <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center font-sans text-xs font-medium text-gray-500">{jobs.length}</span>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 pb-4">
        {jobs.length === 0 ? (
          <div className="flex items-center justify-center h-24 border border-dashed border-gray-200 rounded-xl">
            <p className="font-sans text-xs text-gray-300">No jobs here yet</p>
          </div>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} onApprove={onApprove} onReject={onReject} onSelect={onSelect} />)
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────

export default function Dashboard() {
  const { user, candidateProfile } = useContext(UserContext)
  const [activePage, setActivePage] = useState<NavPage>("dashboard")
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobUrlInput, setJobUrlInput] = useState("")
  const [scraperRunning, setScraperRunning] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [ghostPulse, setGhostPulse] = useState(false)

  // Hunter State
  const [isHunterMode, setIsHunterMode] = useState(false)
  const [hunterRole, setHunterRole] = useState("")
  const [hunterLocation, setHunterLocation] = useState("")
  const [hunterRunning, setHunterRunning] = useState(false)

  // Pre-fill hunter inputs
  useEffect(() => {
    if (candidateProfile?.targetRoles?.length && !hunterRole) {
      setHunterRole(candidateProfile.targetRoles[0])
    }
    if (candidateProfile?.locations?.length && !hunterLocation) {
      setHunterLocation(candidateProfile.locations[0])
    }
  }, [candidateProfile])

  const fetchJobs = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Dashboard] Failed to load jobs:', error.message)
      return
    }

    if (data) {
      const mapped: Job[] = data.map(row => ({
        id: row.id,
        company: row.company,
        title: row.title,
        location: row.location,
        postedAgo: row.posted_ago,
        matchScore: row.match_score,
        column: row.column as ColumnId,
        verdict: row.verdict || '',
        matchesFound: row.matches_found || [],
        missingOrWeak: row.missing_or_weak || [],
        humanInputRequired: row.human_input_required || [],
        sourceUrl: row.source_url || undefined,
        needsInput: row.needs_input || false,
        missingField: row.missing_field || undefined,
      }))
      setJobs(mapped)
      console.log(`[Dashboard] Loaded ${mapped.length} jobs from Supabase.`)
    }
  }

  // Load jobs from Supabase on mount
  useEffect(() => {
    fetchJobs()
  }, [user])

  const handleHuntJobs = async () => {
    if (!hunterRole.trim() || !hunterLocation.trim()) {
       setScrapeError("Please provide both a Role and Location.")
       return
    }
    setHunterRunning(true)
    setScrapeError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("http://localhost:3001/api/hunt-jobs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          searchRole: hunterRole,
          location: hunterLocation,
          candidateProfile,
          userId: user?.id
        })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(err.message ?? "API error")
      }

      const data = await res.json()
      console.log(`[Dashboard] Hunter complete! Discovered ${data.count} jobs.`)
      await fetchJobs() // Refresh UI from Supabase

    } catch (err: unknown) {
      setScrapeError(err instanceof Error ? err.message : String(err))
    } finally {
      setHunterRunning(false)
    }
  }

  const navigateTo = (page: NavPage) => {
    if (page === 'chat') setGhostPulse(false)
    setActivePage(page)
  }

  const handleApprove = (id: string) => {
    console.log("[Dashboard] handleApprove clicked for job ID:", id)
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, column: "applied" as ColumnId } : j))
    setSelectedJob((prev) => prev?.id === id ? { ...prev, column: "applied" as ColumnId } : prev)
    // Sync to Supabase
    if (user) {
      supabase.from('jobs').update({ column: 'applied' }).eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error('[Dashboard] Failed to update job column:', error.message) })
    }
  }

  const handleReject = (id: string) => {
    console.log("[Dashboard] handleReject clicked for job ID:", id)
    setJobs((prev) => prev.filter((j) => j.id !== id))
    setSelectedJob((prev) => prev?.id === id ? null : prev)
    // Delete from Supabase
    if (user) {
      supabase.from('jobs').delete().eq('id', id).eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error('[Dashboard] Failed to delete job:', error.message) })
    }
  }

  const jobsByColumn = (colId: ColumnId) => jobs.filter((j) => j.column === colId)

  const handleRunScraper = async () => {
    const url = jobUrlInput.trim()
    console.log("[Dashboard] Run AI Scraper clicked. Target URL:", url)
    if (!url || !url.startsWith("http")) {
      console.warn("[Dashboard] Run AI Scraper rejected: Invalid URL")
      setScrapeError("Please paste a valid job URL (starting with http/https).")
      return
    }

    setScraperRunning(true)
    setScrapeError(null)

    try {
      const res = await fetch("http://localhost:3001/api/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          candidateProfile,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        console.error("[Dashboard] Scraper API returned non-ok status:", res.status, err)
        throw new Error(err.message ?? "API error")
      }

      const data = await res.json()
      console.log("[Dashboard] Scraper API success! Received data:", data)

      // Map Gemini response → Job card shape
      const jobRow = {
        user_id: user?.id,
        company: data.company ?? "Unknown Company",
        title: data.role ?? "Unknown Role",
        location: "See posting",
        posted_ago: "Just now",
        match_score: data.matchScore ?? 0,
        column: "review",
        verdict: data.verdict ?? "",
        matches_found: data.matchesFound ?? [],
        missing_or_weak: data.missingOrWeak ?? [],
        human_input_required: data.humanInputRequired ?? [],
        source_url: url,
        needs_input: false,
      }

      // Insert into Supabase and use the DB-generated UUID
      let newJob: Job
      if (user) {
        const { data: inserted, error } = await supabase
          .from('jobs')
          .insert(jobRow)
          .select()
          .single()

        if (error) {
          console.error('[Dashboard] Failed to insert job into Supabase:', error.message)
          // Fall back to local-only job with temp ID
          newJob = { id: `job-${Date.now()}`, company: jobRow.company, title: jobRow.title, location: jobRow.location, postedAgo: jobRow.posted_ago, matchScore: jobRow.match_score, column: 'review', verdict: jobRow.verdict, matchesFound: jobRow.matches_found, missingOrWeak: jobRow.missing_or_weak, humanInputRequired: jobRow.human_input_required, sourceUrl: url }
        } else {
          newJob = { id: inserted.id, company: inserted.company, title: inserted.title, location: inserted.location, postedAgo: inserted.posted_ago, matchScore: inserted.match_score, column: inserted.column as ColumnId, verdict: inserted.verdict || '', matchesFound: inserted.matches_found || [], missingOrWeak: inserted.missing_or_weak || [], humanInputRequired: inserted.human_input_required || [], sourceUrl: inserted.source_url || url }
        }
      } else {
        newJob = { id: `job-${Date.now()}`, company: jobRow.company, title: jobRow.title, location: jobRow.location, postedAgo: jobRow.posted_ago, matchScore: jobRow.match_score, column: 'review', verdict: jobRow.verdict, matchesFound: jobRow.matches_found, missingOrWeak: jobRow.missing_or_weak, humanInputRequired: jobRow.human_input_required, sourceUrl: url }
      }

      setJobs((prev) => [newJob, ...prev])
      setJobUrlInput("")
    } catch (err) {
      console.error("[Dashboard] Catch block triggered during scraper run:", err)
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setScrapeError("Network Error: Could not reach the backend server. Please make sure the backend is running (cd backend && npm run dev).")
      } else {
        const msg = err instanceof Error ? err.message : "An unknown error occurred."
        setScrapeError(msg)
      }
    } finally {
      setScraperRunning(false)
    }
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={navigateTo} ghostPulse={ghostPulse} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activePage === 'chat' ? (
          <div className="flex-1 p-8 h-full">
            <GhostChat />
          </div>
        ) : (
          <>
            {/* Top Action Bar */}
            <header className="bg-white border-b border-gray-200 px-8 py-5 flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 shrink-0">
                  <h1 className="font-heading font-bold text-2xl text-[#0A0A0A]">Job Tracker</h1>
                  
                  {/* Mode Toggle */}
                  <div className="flex bg-gray-100 p-0.5 rounded-sm">
                    <button 
                      onClick={() => { setIsHunterMode(false); setScrapeError(null) }}
                      className={`px-3 py-1 font-sans text-xs font-medium rounded-sm transition-colors ${!isHunterMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Paste Link
                    </button>
                    <button 
                      onClick={() => { setIsHunterMode(true); setScrapeError(null) }}
                      className={`px-3 py-1 font-sans text-xs font-medium rounded-sm transition-colors flex items-center gap-1 ${isHunterMode ? 'bg-white shadow-sm text-[#0A0A0A]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Bot size={12} /> The Hunter
                    </button>
                  </div>
                </div>

                {isHunterMode ? (
                  <div className="flex-1 flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={hunterRole}
                        onChange={(e) => setHunterRole(e.target.value)}
                        placeholder="Role (e.g. Frontend Engineer)"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-sans text-sm focus:outline-none focus:border-[#0A0A0A]"
                        disabled={hunterRunning}
                      />
                    </div>
                    <div className="w-48 relative">
                      <input
                        type="text"
                        value={hunterLocation}
                        onChange={(e) => setHunterLocation(e.target.value)}
                        placeholder="Location (e.g. Remote)"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-sans text-sm focus:outline-none focus:border-[#0A0A0A]"
                        disabled={hunterRunning}
                      />
                    </div>
                    <button
                      onClick={handleHuntJobs}
                      disabled={hunterRunning || !hunterRole.trim() || !hunterLocation.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white font-sans font-medium text-sm rounded-sm hover:bg-gray-800 disabled:opacity-50 shrink-0"
                    >
                      {hunterRunning
                        ? <><Loader2 size={13} className="animate-spin" />Scanning...</>
                        : <><Search size={13} />Hunt Roles</>
                      }
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex gap-3">
                    <div className="flex-1 relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={1.5} />
                      <input
                        type="url"
                        value={jobUrlInput}
                        onChange={(e) => { setJobUrlInput(e.target.value); setScrapeError(null) }}
                        onKeyDown={(e) => e.key === "Enter" && !scraperRunning && handleRunScraper()}
                        placeholder="Paste a job posting URL (e.g. linkedin.com/jobs/…)"
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-sans text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#0A0A0A] transition-colors"
                        disabled={scraperRunning}
                      />
                    </div>
                    <button
                      onClick={handleRunScraper}
                      disabled={scraperRunning || !jobUrlInput.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white font-sans font-medium text-sm rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {scraperRunning
                        ? <><Loader2 size={13} strokeWidth={2} className="animate-spin" />Analysing...</>
                        : <><Play size={13} strokeWidth={2} />Run AI Scraper</>
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Error banner */}
              {scrapeError && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-sm">
                  <AlertCircle size={14} className="text-red-500 shrink-0" strokeWidth={1.5} />
                  <p className="font-sans text-xs text-red-700">{scrapeError}</p>
                </div>
              )}
            </header>

            {/* Kanban Board */}
            <div className="flex-1 overflow-hidden p-8">
              <div className="grid grid-cols-3 gap-6 h-full">
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    jobs={jobsByColumn(col.id)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onSelect={setSelectedJob}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Match Report Slide-over */}
      <MatchReportPanel
        job={selectedJob}
        isOpen={selectedJob !== null}
        onClose={() => setSelectedJob(null)}
        onApprove={(id) => { handleApprove(id); setSelectedJob(null) }}
        onReject={(id) => { handleReject(id); setSelectedJob(null) }}
        onNeedsInput={(id, missingField) => {
          console.log("[Dashboard] NEEDS_INPUT for job:", id, "missing:", missingField)
          setJobs(prev => prev.map(j => j.id === id ? { ...j, needsInput: true, missingField } : j))
          setSelectedJob(prev => prev?.id === id ? { ...prev, needsInput: true, missingField } : prev)
          setGhostPulse(true)
          // Persist the needs_input flag to Supabase
          if (user) {
            supabase.from('jobs').update({ needs_input: true, missing_field: missingField }).eq('id', id).eq('user_id', user.id)
              .then(({ error }) => { if (error) console.error('[Dashboard] Failed to persist needs_input:', error.message) })
          }
        }}
      />
    </div>
  )
}
