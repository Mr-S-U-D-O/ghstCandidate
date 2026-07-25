import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
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
} from "lucide-react"

type ColumnId = "discovered" | "review" | "applied"

interface Job {
  id: string
  company: string
  title: string
  location: string
  postedAgo: string
  matchScore: number
  column: ColumnId
}

const INITIAL_JOBS: Job[] = [
  { id: "1", company: "Stripe", title: "Senior Frontend Engineer", location: "Remote", postedAgo: "2 hours ago", matchScore: 94, column: "discovered" },
  { id: "2", company: "Vercel", title: "Staff Software Engineer", location: "Remote", postedAgo: "5 hours ago", matchScore: 87, column: "discovered" },
  { id: "3", company: "Linear", title: "Product Engineer", location: "San Francisco, CA", postedAgo: "1 day ago", matchScore: 72, column: "review" },
  { id: "4", company: "OpenAI", title: "Frontend Engineer, Growth", location: "San Francisco, CA", postedAgo: "3 hours ago", matchScore: 91, column: "review" },
  { id: "5", company: "Notion", title: "Software Engineer, Platform", location: "Remote", postedAgo: "2 days ago", matchScore: 83, column: "applied" },
]

const COLUMNS: { id: ColumnId; label: string; description: string }[] = [
  { id: "discovered", label: "Discovered", description: "Raw scraped jobs" },
  { id: "review", label: "Review", description: "Awaiting your approval" },
  { id: "applied", label: "Applied", description: "Handled by your Ghost" },
]

function MatchBadge({ score }: { score: number }) {
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

interface JobCardProps {
  job: Job
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

function JobCard({ job, onApprove, onReject }: JobCardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer group"
      style={{ boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s ease" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        <MatchBadge score={job.matchScore} />
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

type NavPage = "dashboard" | "resumes" | "settings"

const NAV_ITEMS: { id: NavPage; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "resumes", label: "Resumes", Icon: FileText },
  { id: "settings", label: "Ghost Settings", Icon: Settings },
]

interface SidebarProps {
  activePage: NavPage
  onNavigate: (page: NavPage) => void
}

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200" style={{ width: "250px", minWidth: "250px" }}>
      <div className="p-6 border-b border-gray-100">
        <span className="font-heading font-bold text-xl text-[#0A0A0A] tracking-tight">ghstCandidate</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activePage === id
          return (
            <button key={id} onClick={() => onNavigate(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-colors text-left ${isActive ? "bg-gray-100 text-[#0A0A0A]" : "text-gray-500 hover:text-[#0A0A0A] hover:bg-gray-50"}`}>
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} className={isActive ? "text-[#0A0A0A]" : "text-gray-400"} />
              {label}
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

interface KanbanColumnProps {
  column: typeof COLUMNS[number]
  jobs: Job[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

function KanbanColumn({ column, jobs, onApprove, onReject }: KanbanColumnProps) {
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
          jobs.map((job) => <JobCard key={job.id} job={job} onApprove={onApprove} onReject={onReject} />)
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [activePage, setActivePage] = useState<NavPage>("dashboard")
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS)
  const [searchQuery, setSearchQuery] = useState("")
  const [scraperRunning, setScraperRunning] = useState(false)

  const handleApprove = (id: string) => setJobs((prev) => prev.map((j) => j.id === id ? { ...j, column: "applied" as ColumnId } : j))
  const handleReject = (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id))
  const handleRunScraper = () => { setScraperRunning(true); setTimeout(() => setScraperRunning(false), 2500) }
  const jobsByColumn = (colId: ColumnId) => jobs.filter((j) => j.column === colId)

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between gap-6 shrink-0">
          <h1 className="font-heading font-bold text-2xl text-[#0A0A0A] shrink-0">Job Tracker</h1>
          <div className="flex-1 max-w-xl relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={1.5} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Paste a job URL or search role / location..." className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-sans text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#0A0A0A] transition-colors" />
          </div>
          <button onClick={handleRunScraper} disabled={scraperRunning} className="flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white font-sans font-medium text-sm rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-60 shrink-0">
            <Play size={13} strokeWidth={2} className={scraperRunning ? "animate-pulse" : ""} />
            {scraperRunning ? "Scraping..." : "Run AI Scraper"}
          </button>
        </header>
        <div className="flex-1 overflow-hidden p-8">
          <div className="grid grid-cols-3 gap-6 h-full">
            {COLUMNS.map((col) => (
              <KanbanColumn key={col.id} column={col} jobs={jobsByColumn(col.id)} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
