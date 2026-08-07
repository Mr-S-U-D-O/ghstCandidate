import React, { useState, useEffect, useContext } from "react"
import { useNavigate } from "react-router-dom"
import MatchReportPanel from "./MatchReportPanel"
import GhostChat from "./GhostChat"
import ProfileHub from "./ProfileHub"
import ResumesPage from "./ResumesPage"
import CoverLettersPage from "./CoverLettersPage"
import DeleteAccountModal from "./DeleteAccountModal"
import { UserContext } from "../context/UserContext"
import { supabase } from "../supabaseClient"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
import {
  LayoutDashboard,
  FileText,
  Settings,
  Search,
  Play,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Bot,
  User,
  Mail,
  Check
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

// ── Tech Roles (Data Lake niche) ──────────────────────────────────

// Tech roles removed — Hunter now uses free-text input pre-filled from user profile

// ── Match Badge ───────────────────────────────────────────────────

function MatchBadge({ score, needsInput, missingField }: { score: number; needsInput?: boolean; missingField?: string }) {
  if (needsInput && missingField) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans bg-gray-100 text-gray-700 border border-gray-200 shadow-sm">
        <AlertCircle size={12} strokeWidth={2.5} />
        Needs Input
      </span>
    )
  }
  if (score >= 85) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans bg-[#0A0A0A] text-white shadow-sm ring-1 ring-black/5 inset-ring">
        {score}% Match
      </span>
    )
  }
  if (score >= 70) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans bg-orange-50 text-orange-700 border border-orange-200 shadow-sm">
        {score}% Match
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans bg-gray-50 text-gray-500 border border-gray-200 shadow-sm">
      {score}% Match
    </span>
  )
}

// ── Job Card ──────────────────────────────────────────────────────

interface JobCardProps {
  job: Job
  onApprove?: (id: string) => void
  onReject?: (id: string) => Promise<void>
  onSelect?: (job: Job) => void
}

function JobCard({ job, onReject, onSelect }: JobCardProps) {
  const [hovered, setHovered] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const handleRejectClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onReject) return
    setIsRejecting(true)
    try {
      // Assuming onReject returns a Promise now
      await onReject(job.id)
    } catch (err) {
      console.error(err)
      setIsRejecting(false)
    }
  }

  const renderActionButtons = () => {
    if (job.column === 'applied') {
      return (
        <div className="flex items-center gap-1.5">
          {onReject && (
            <button onClick={handleRejectClick} disabled={isRejecting} className="flex items-center gap-1 px-3 py-1.5 bg-white text-gray-500 text-xs font-sans font-medium rounded-sm border border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-colors">
              {isRejecting ? <Loader2 size={11} className="animate-spin" /> : <X size={11} strokeWidth={2.5} />}
              {isRejecting ? 'Archiving' : 'Archive'}
            </button>
          )}
          {job.sourceUrl && (
            <a href={job.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 px-3 py-1.5 bg-[#0A0A0A] text-white text-xs font-sans font-medium rounded-sm hover:bg-gray-800 transition-colors">
              View Posting
            </a>
          )}
        </div>
      )
    }

    if (job.needsInput) {
      return (
        <div className="flex items-center gap-2">
          {onReject && (
            <button onClick={handleRejectClick} disabled={isRejecting} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Reject">
              {isRejecting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} strokeWidth={2.5} />}
            </button>
          )}
          <button onClick={() => onSelect?.(job)} className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 text-xs font-sans font-bold rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors shadow-sm">
            Resolve & Resume
          </button>
        </div>
      )
    }

    const isAnalysisFailed = job.verdict?.includes("Retry Analysis") || (job.company === "Unknown Company" && job.matchScore === 0)
    const isUnanalyzed = !job.verdict && job.matchScore === 0 && (job.company === "Unknown" || job.company === "Unknown Company")

    if (isAnalysisFailed) {
      return (
        <div className="flex items-center gap-2">
          {onReject && (
            <button onClick={handleRejectClick} disabled={isRejecting} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Reject">
              {isRejecting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} strokeWidth={2.5} />}
            </button>
          )}
          <button onClick={() => onSelect?.(job)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-xs font-sans font-bold rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors shadow-sm">
            Retry Analysis
          </button>
        </div>
      )
    }

    if (isUnanalyzed) {
      return (
        <div className="flex items-center gap-2">
          {onReject && (
            <button onClick={handleRejectClick} disabled={isRejecting} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Reject">
              {isRejecting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} strokeWidth={2.5} />}
            </button>
          )}
          <button onClick={() => onSelect?.(job)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-gray-800 to-[#0A0A0A] text-white text-xs font-sans font-bold rounded-lg hover:from-gray-700 hover:to-gray-900 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] ring-1 ring-white/10 inset-ring">
            Run Scraper
          </button>
        </div>
      )
    }

    // Default: Awaiting Approval (State C)
    return (
      <div className="flex items-center gap-2">
        {onReject && (
          <button onClick={handleRejectClick} disabled={isRejecting} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Reject">
            {isRejecting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} strokeWidth={2.5} />}
          </button>
        )}
        <button onClick={() => onSelect?.(job)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-gray-800 to-[#0A0A0A] text-white text-xs font-sans font-bold rounded-lg hover:from-gray-700 hover:to-gray-900 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] ring-1 ring-white/10 inset-ring">
          Apply Now
        </button>
      </div>
    )
  }

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl p-6 cursor-pointer flex flex-col relative overflow-hidden group"
      style={{ boxShadow: hovered ? 'var(--shadow-float)' : 'var(--shadow-soft)', transform: hovered ? 'translateY(-2px)' : 'none', transition: 'var(--transition-spring)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!isRejecting) {
          console.log(`[Dashboard] JobCard clicked: ${job.title} at ${job.company} (ID: ${job.id})`)
          onSelect?.(job)
        }
      }}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="font-heading text-lg font-bold text-[#0A0A0A] leading-snug group-hover:text-orange-600" style={{ transition: 'var(--transition-smooth)' }}>{job.title}</p>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-gray-400 shrink-0 ml-3 bg-gray-50 px-2 py-1 rounded-md">
          <Clock size={10} strokeWidth={2.5} />
          {job.postedAgo}
        </span>
      </div>
      <p className="font-sans text-sm font-medium text-gray-500 leading-snug mb-5 flex flex-wrap gap-x-2 items-center">
        <span className="text-gray-900 font-semibold">{job.company}</span>
        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
        <span className="text-gray-500">{job.location}</span>
      </p>

      {job.needsInput && (
        <div className="mb-5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="font-sans text-xs font-medium text-gray-700 flex items-center gap-1.5">
            <AlertCircle size={14} strokeWidth={2.5} className="text-gray-500" /> 
            {job.missingField || "Agent Paralyzed"}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <MatchBadge score={job.matchScore} needsInput={job.needsInput} missingField={job.missingField} />
        {renderActionButtons()}
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────

type NavPage = "dashboard" | "chat" | "resumes" | "cover_letters" | "profile" | "settings"

const NAV_ITEMS: { id: NavPage; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard", label: "Job Tracker", Icon: LayoutDashboard },
  { id: "chat", label: "Ghost Profiler", Icon: Bot },
  { id: "resumes", label: "Resumes", Icon: FileText },
  { id: "cover_letters", label: "Cover Letters", Icon: Mail },
  { id: "profile", label: "AI Memory & Profile", Icon: User },
  { id: "settings", label: "Ghost Settings", Icon: Settings },
]

function Sidebar({ activePage, onNavigate, ghostPulse, isOpen, onClose, candidateProfile }: { activePage: NavPage; onNavigate: (p: NavPage) => void; ghostPulse?: boolean; isOpen?: boolean; onClose?: () => void; candidateProfile?: any }) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isUserMenuOpen])

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col h-full bg-white border-r border-gray-200 transition-transform transform md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ width: "250px", minWidth: "250px" }}>
      <div className="p-6 border-b border-gray-100 flex items-center gap-1">
        <img src="/logo-transparent.png" alt="ghstCandidate Logo" className="h-8 w-auto -mr-1.5" />
        <span className="font-heading font-bold text-xl text-[#0A0A0A] tracking-tight">ghstCandidate</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activePage === id
          const isPulse = id === 'chat' && ghostPulse && !isActive
          return (
            <button key={id} onClick={() => onNavigate(id)} className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-colors text-left ${isActive ? "bg-orange-50 text-orange-600" : "text-gray-500 hover:text-[#0A0A0A] hover:bg-gray-50"}`}>
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} className={isActive ? "text-orange-600" : "text-gray-400"} />
              {label}
              {isPulse && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
              )}
            </button>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-100 relative" ref={menuRef}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
            <span className="font-sans font-bold text-xs text-white">
              {candidateProfile?.name ? candidateProfile.name.charAt(0).toUpperCase() : 'G'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans font-medium text-xs text-[#0A0A0A] truncate">{candidateProfile?.name || 'Candidate'}</p>
            <p className="font-sans text-xs text-gray-400">Free tier</p>
          </div>
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
            className="text-gray-400 hover:text-[#0A0A0A] transition-colors p-1.5 rounded-md hover:bg-gray-50 flex-shrink-0"
            aria-label="User Settings"
          >
            <Settings size={18} strokeWidth={1.5} />
          </button>
        </div>

        {isUserMenuOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="px-5 py-3 border-b border-gray-100 mb-1">
              <p className="font-heading text-sm font-bold text-[#0A0A0A] truncate">{candidateProfile?.name || 'Candidate'}</p>
            </div>
            <button className="w-full text-left px-5 py-3 font-sans text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#0A0A0A] transition-colors">
              Account Settings
            </button>
            <button className="w-full text-left px-5 py-3 font-sans text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#0A0A0A] transition-colors">
              Manage Subscription
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-5 py-3 font-sans text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#0A0A0A] transition-colors">
              Sign Out
            </button>
            <hr className="my-2 border-gray-100" />
            <button
              onClick={() => { setIsUserMenuOpen(false); setIsDeleteModalOpen(true) }}
              className="w-full text-left px-5 py-3 font-sans text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
              Delete Account
            </button>
          </div>
        )}
      </div>
    </aside>
    <DeleteAccountModal
      isOpen={isDeleteModalOpen}
      onClose={() => setIsDeleteModalOpen(false)}
      userName={candidateProfile?.name || 'Candidate'}
    />
    </>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────

function KanbanColumn({ column, jobs, onApprove, onReject, onSelect }: {
  column: typeof COLUMNS[number]
  jobs: Job[]
  onApprove: (id: string) => void
  onReject: (id: string) => Promise<void>
  onSelect: (job: Job) => void
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4 bg-gray-50/80 backdrop-blur-sm px-4 py-3 rounded-xl border border-gray-200/50 shadow-sm">
        <div>
          <span className="font-heading text-xs font-bold uppercase tracking-wider text-gray-800">{column.label}</span>
          <p className="font-sans text-[11px] font-medium text-gray-500 mt-0.5">{column.description}</p>
        </div>
        <span className="w-6 h-6 rounded-full bg-white shadow-sm ring-1 ring-gray-200/50 flex items-center justify-center font-sans text-xs font-bold text-[#0A0A0A]">{jobs.length}</span>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 pb-4">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
            <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
            </span>
            <p className="font-sans text-xs font-medium text-gray-400">No jobs here yet</p>
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
  const navigate = useNavigate()
  
  const [activePage, setActivePage] = useState<NavPage>("dashboard")
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobUrlInput, setJobUrlInput] = useState("")
  const [scraperRunning, setScraperRunning] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [huntResult, setHuntResult] = useState<{ type: 'success' | 'info', message: string } | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [ghostPulse, setGhostPulse] = useState(false)

  // Hunter State
  const [isHunterMode, setIsHunterMode] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hunterRole, setHunterRole] = useState("")
  const [hunterLocation, setHunterLocation] = useState("")
  const [hunterRunning, setHunterRunning] = useState(false)
  const [huntingStatus, setHuntingStatus] = useState("")

  // Cycling status effect
  useEffect(() => {
    if (!hunterRunning) {
      setHuntingStatus("")
      return
    }
    
    const messages = [
      "Searching ATS Databases...",
      "Extracting job details...",
      "Scoring match with Gemini...",
      "Persisting to database..."
    ]
    let msgIndex = 0
    setHuntingStatus(messages[msgIndex])
    
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length
      setHuntingStatus(messages[msgIndex])
    }, 4000)
    
    return () => clearInterval(interval)
  }, [hunterRunning])

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

  // ── Supabase Realtime — auto-refresh when cron/agent updates jobs ──
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('[Dashboard] Realtime event:', payload.eventType)
          fetchJobs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const handleHuntJobs = async () => {
    if (!hunterRole.trim() || !hunterLocation.trim()) {
       setScrapeError("Please provide both a Role and Location.")
       return
    }
    setHunterRunning(true)
    setScrapeError(null)
    setHuntResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch(`${API_BASE_URL}/api/hunt-jobs`, {
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

      if (data.count > 0) {
        setHuntResult({ type: 'success', message: `Hunt complete! Found ${data.count} new high-match jobs.` })
      } else {
        setHuntResult({ type: 'info', message: `Hunt complete. No new matches found above the 40% threshold.` })
      }

      // Auto-hide the result after 6 seconds
      setTimeout(() => {
        setHuntResult(null)
      }, 6000)

    } catch (err: unknown) {
      setScrapeError(err instanceof Error ? err.message : String(err))
    } finally {
      setHunterRunning(false)
    }
  }

  const navigateTo = (page: NavPage) => {
    if (page === 'settings') {
      // Route to ProfileHub instead of broken /settings → OnboardingFlow
      setActivePage('profile')
      return
    }
    if (page === 'chat') setGhostPulse(false)
    setActivePage(page)
  }

  const handleApprove = (id: string) => {
    console.log("[Dashboard] handleApprove clicked for job ID:", id)
    // Route through MatchReportPanel so the agent actually runs
    const targetJob = jobs.find(j => j.id === id)
    if (targetJob) {
      setSelectedJob(targetJob)
    }
  }

  const handleReject = async (id: string) => {
    console.log("[Dashboard] handleReject clicked for job ID:", id)
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${API_BASE_URL}/api/jobs/${id}`, {
        method: "DELETE",
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        }
      })

      if (!res.ok) {
        throw new Error("Failed to delete job on backend")
      }

      setJobs((prev) => prev.filter((j) => j.id !== id))
      setSelectedJob((prev) => prev?.id === id ? null : prev)
    } catch (err) {
      console.error('[Dashboard] ❌ handleReject error:', err)
      // Fallback local UI removal or re-throw
      throw err
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
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${API_BASE_URL}/api/analyze-job`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          url,
          candidateProfile,
          userId: user?.id
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
    <div className="flex h-[100dvh] w-full bg-gray-50 overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={(p) => { navigateTo(p); setIsMobileMenuOpen(false); }}
        ghostPulse={ghostPulse}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        candidateProfile={candidateProfile}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/logo-transparent.png" alt="Logo" className="h-6 w-auto" />
            <span className="font-heading font-bold text-lg text-[#0A0A0A]">ghstCandidate</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-[#0A0A0A]">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>

        {activePage === 'chat' ? (
          <div className="flex-1 p-8 h-full">
            <GhostChat />
          </div>
        ) : activePage === 'profile' ? (
          <ProfileHub />
        ) : activePage === 'resumes' ? (
          <ResumesPage />
        ) : activePage === 'cover_letters' ? (
          <CoverLettersPage />
        ) : (
          <>
            {/* Top Action Bar */}
            <header className="glass-panel sticky top-0 z-10 border-b border-gray-200/60 p-4 md:px-8 md:py-6 flex flex-col gap-4 shrink-0">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
                <div className="flex flex-col gap-3 shrink-0">
                  {/* Mode Toggle */}
                  <div className="flex bg-gray-100/80 p-1 rounded-lg border border-gray-200/50 w-fit">
                    <button 
                      onClick={() => { setIsHunterMode(false); setScrapeError(null) }}
                      className={`px-4 py-1.5 font-sans text-sm font-semibold rounded-md transition-all ${!isHunterMode ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Paste Link
                    </button>
                    <button 
                      onClick={() => { setIsHunterMode(true); setScrapeError(null) }}
                      className={`px-4 py-1.5 font-sans text-sm font-semibold rounded-md transition-all flex items-center gap-1.5 ${isHunterMode ? 'bg-white shadow-sm text-[#0A0A0A] ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Bot size={14} /> The Hunter
                    </button>
                  </div>
                </div>

                {isHunterMode ? (
                  <div className="flex-1 flex flex-col">
                    <div className="flex flex-col md:flex-row gap-3 items-end">
                      <div className="flex-1 relative">
                        <label className="block font-sans text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">Target Role</label>
                        <input
                          type="text"
                          value={hunterRole}
                          onChange={(e) => setHunterRole(e.target.value)}
                          placeholder="e.g. Frontend Developer, Data Scientist"
                          className="w-full px-4 py-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl font-sans text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm placeholder:text-gray-300"
                          disabled={hunterRunning}
                        />
                      </div>
                      <div className="w-full md:w-64 relative">
                        <label className="block font-sans text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">Location</label>
                        <input
                          type="text"
                          value={hunterLocation}
                          onChange={(e) => setHunterLocation(e.target.value)}
                          placeholder="e.g. Remote, Worldwide"
                          className="w-full px-4 py-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl font-sans text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm placeholder:text-gray-300"
                          disabled={hunterRunning}
                        />
                      </div>
                      <button
                        onClick={handleHuntJobs}
                        disabled={hunterRunning || !hunterRole.trim() || !hunterLocation.trim()}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-sans font-bold text-sm rounded-xl disabled:opacity-50 shrink-0 shadow-[0_2px_10px_rgba(249,115,22,0.2)] hover:shadow-[0_4px_14px_rgba(249,115,22,0.3)] transition-all ring-1 ring-white/20 inset-ring h-[46px]"
                      >
                        {hunterRunning
                          ? <><Loader2 size={16} className="animate-spin" />Scanning...</>
                          : <><Search size={16} strokeWidth={2.5} />Hunt Roles</>
                        }
                      </button>
                    </div>
                    {hunterRunning && (
                      <div className="flex items-center gap-2 text-xs font-sans text-orange-500 font-medium mt-3 ml-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
                        {huntingStatus}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 relative">
                      <label className="block font-sans text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">Single Job URL</label>
                      <Search size={16} className="absolute left-4 top-[38px] text-gray-400" strokeWidth={2} />
                      <input
                        type="url"
                        value={jobUrlInput}
                        onChange={(e) => { setJobUrlInput(e.target.value); setScrapeError(null) }}
                        onKeyDown={(e) => e.key === "Enter" && !scraperRunning && handleRunScraper()}
                        placeholder="Paste a job posting URL (e.g. linkedin.com/jobs/…)"
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl font-sans text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 focus:border-[#0A0A0A] transition-all shadow-sm"
                        disabled={scraperRunning}
                      />
                    </div>
                    <button
                      onClick={handleRunScraper}
                      disabled={scraperRunning || !jobUrlInput.trim()}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-b from-gray-800 to-[#0A0A0A] hover:from-gray-700 hover:to-gray-900 text-white font-sans font-bold text-sm rounded-xl transition-all shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] ring-1 ring-white/10 inset-ring disabled:opacity-50 shrink-0 h-[46px]"
                    >
                      {scraperRunning
                        ? <><Loader2 size={16} strokeWidth={2.5} className="animate-spin" />Analysing...</>
                        : <><Play size={16} strokeWidth={2.5} fill="currentColor" />Run Scraper</>
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Error banner */}
              {scrapeError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mt-2">
                  <AlertCircle size={16} className="text-red-500 shrink-0" strokeWidth={2} />
                  <p className="font-sans text-sm font-medium text-red-800">{scrapeError}</p>
                </div>
              )}

              {/* Success/Info banner */}
              {huntResult && (
                <div className={`flex items-center gap-2 px-4 py-3 border rounded-xl mt-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
                  huntResult.type === 'success' 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  {huntResult.type === 'success' ? (
                    <Check size={16} className="text-green-600 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <AlertCircle size={16} className="text-blue-500 shrink-0" strokeWidth={2} />
                  )}
                  <p className="font-sans text-sm font-medium">{huntResult.message}</p>
                </div>
              )}
            </header>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto p-4 md:p-8">
              <div className="flex gap-4 md:gap-6 h-full flex-nowrap min-w-max md:min-w-0 md:grid md:grid-cols-3 overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`
                  div::-webkit-scrollbar { display: none; }
                `}</style>
                {COLUMNS.map((col) => (
                  <div key={col.id} className="w-[85vw] md:w-auto snap-center shrink-0 h-full">
                    <KanbanColumn
                      column={col}
                      jobs={jobsByColumn(col.id)}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onSelect={setSelectedJob}
                    />
                  </div>
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
        onApprove={(id) => {
          // After agent success, update local state and sync to Supabase
          setJobs((prev) => prev.map((j) => j.id === id ? { ...j, column: "applied" as ColumnId } : j))
          setSelectedJob(null)
          if (user) {
            supabase.from('jobs').update({ column: 'applied' }).eq('id', id).eq('user_id', user.id)
              .then(({ error }) => { if (error) console.error('[Dashboard] Failed to update job column:', error.message) })
          }
        }}
        onReject={(id) => { handleReject(id); setSelectedJob(null) }}
        onNeedsInput={(id, missingField) => {
          console.log("[Dashboard] NEEDS_INPUT for job:", id, "missing:", missingField)
          setJobs(prev => prev.map(j => j.id === id ? { ...j, needsInput: true, missingField } : j))
          setSelectedJob(prev => prev?.id === id ? { ...prev, needsInput: true, missingField } : prev)
          setGhostPulse(true)
          if (user) {
            supabase.from('jobs').update({ needs_input: true, missing_field: missingField }).eq('id', id).eq('user_id', user.id)
              .then(({ error }) => { if (error) console.error('[Dashboard] Failed to persist needs_input:', error.message) })
          }
        }}
        onJobUpdated={fetchJobs}
      />
    </div>
  )
}
