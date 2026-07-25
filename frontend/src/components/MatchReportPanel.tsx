import React from "react"
import { X, FileText, Check, AlertTriangle, MapPin, Clock } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────

export interface Job {
  id: string
  company: string
  title: string
  location: string
  postedAgo: string
  matchScore: number
  column: "discovered" | "review" | "applied"
}

interface MatchReportPanelProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

// ── Match Badge ───────────────────────────────────────────────────

function MatchBadgeLarge({ score }: { score: number }) {
  if (score >= 85) {
    return (
      <span className="inline-flex items-center px-3 py-1.5 rounded-sm text-sm font-medium font-sans bg-green-50 text-green-800 border border-green-100">
        {score}% Match
      </span>
    )
  }
  if (score >= 70) {
    return (
      <span className="inline-flex items-center px-3 py-1.5 rounded-sm text-sm font-medium font-sans bg-amber-50 text-amber-700 border border-amber-100">
        {score}% — Needs Input
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-sm text-sm font-medium font-sans bg-gray-100 text-gray-500 border border-gray-200">
      {score}% Match
    </span>
  )
}

// ── AI Verdict content by company ────────────────────────────────

function getVerdict(company: string): string {
  const verdicts: Record<string, string> = {
    Stripe: "Your experience with React and TypeScript perfectly aligns with their core stack. You have a strong track record of high-traffic frontend systems, which Stripe values deeply. However, your master CV does not explicitly mention GraphQL, which they list as a preferred skill. A targeted resume variant can compensate for this gap.",
    Vercel: "Your background in Next.js and performance optimization is an exceptionally strong signal for this role. Vercel builds the tools you use — this match reflects genuine alignment. Minor gap: they prefer candidates with open-source contributions. Consider linking your GitHub in the application.",
    Linear: "This role is a partial match. Your frontend skills translate well, but Linear is seeking someone with prior product-focused engineering experience — owning features end-to-end, not just implementing designs. The 72% score reflects this structural gap. Human review is recommended before queuing.",
    OpenAI: "Strong technical alignment across the board. OpenAI's Growth team is focused on funnel optimization and A/B experimentation — your analytics and conversion work is directly relevant. The only notable gap is no prior experience with Statsig or similar feature-flag platforms, which they prefer.",
    Notion: "Solid match for a platform role. Your systems-level thinking and API design experience are clearly present in your CV. Notion emphasizes cross-functional collaboration heavily — your project lead experience is a differentiator here.",
  }
  return verdicts[company] ?? "Strong overall match based on your profile. Your Ghost will generate a tailored resume variant and prepare standard responses before submission."
}

function getSkillMatches(company: string): string[] {
  const matches: Record<string, string[]> = {
    Stripe: ["5+ years React / TypeScript", "Payment & fintech experience", "Unit & integration testing", "REST API design"],
    Vercel: ["Next.js expert-level usage", "Performance optimization", "Edge functions familiarity", "CI/CD pipeline experience"],
    Linear: ["Frontend component systems", "Design-to-code fidelity", "Collaborative tooling"],
    OpenAI: ["A/B testing & analytics", "React + TypeScript", "Growth funnel experience", "Cross-functional shipping"],
    Notion: ["API design experience", "Platform architecture", "Cross-functional collaboration", "TypeScript depth"],
  }
  return matches[company] ?? ["React / TypeScript", "Strong design sensibility", "Team leadership"]
}

function getSkillGaps(company: string): string[] {
  const gaps: Record<string, string[]> = {
    Stripe: ["GraphQL (nice-to-have)", "Rust / backend exposure"],
    Vercel: ["Open-source contributions", "Rust knowledge"],
    Linear: ["Product ownership experience", "Customer-facing feature ownership"],
    OpenAI: ["Statsig or LaunchDarkly", "ML product familiarity"],
    Notion: ["Distributed systems scale", "On-call engineering experience"],
  }
  return gaps[company] ?? ["Minor gaps only — strong overall fit"]
}

// ── Execution Plan Items ──────────────────────────────────────────

const EXECUTION_PLAN = [
  {
    Icon: FileText,
    text: "Generating tailored resume variant emphasising most relevant experience.",
    type: "action",
  },
  {
    Icon: Check,
    text: "Auto-answering standard EEOC and compliance questions.",
    type: "action",
  },
  {
    Icon: AlertTriangle,
    text: "Will pause for human input on: \"Desired Salary\" and \"Years at current role\".",
    type: "warn",
  },
]

// ── Panel ─────────────────────────────────────────────────────────

export default function MatchReportPanel({ job, isOpen, onClose, onApprove, onReject }: MatchReportPanelProps) {
  const handleApprove = () => {
    if (job) { onApprove(job.id); onClose() }
  }
  const handleReject = () => {
    if (job) { onReject(job.id); onClose() }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: "rgba(0,0,0,0.2)",
          backdropFilter: "blur(2px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        className="fixed top-0 right-0 h-screen bg-white z-50 flex flex-col"
        style={{
          width: "600px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {job && (
          <>
            {/* ── 1. Sticky Header ── */}
            <div className="shrink-0 bg-white border-b border-gray-100 px-8 pt-8 pb-6">
              {/* Close */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 font-sans text-sm transition-colors"
                >
                  <X size={16} strokeWidth={1.5} />
                  Close
                </button>
              </div>

              {/* Company & Title */}
              <p className="font-heading font-bold text-lg text-gray-400 mb-1">{job.company}</p>
              <h2 className="font-heading font-bold text-3xl text-[#0A0A0A] leading-tight mb-5">
                {job.title}
              </h2>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <MatchBadgeLarge score={job.matchScore} />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-sans text-gray-500 bg-gray-50 border border-gray-200">
                  <MapPin size={13} strokeWidth={1.5} />
                  {job.location}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-sans text-gray-400 bg-gray-50 border border-gray-200">
                  <Clock size={13} strokeWidth={1.5} />
                  {job.postedAgo}
                </span>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* ── 2. AI Verdict ── */}
              <div className="px-8 py-6 border-b border-gray-100">
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                  The Ghost's Verdict
                </p>
                <p className="font-sans text-base text-gray-700 leading-relaxed">
                  {getVerdict(job.company)}
                </p>
              </div>

              {/* ── 3. Skill Matrix ── */}
              <div className="px-8 py-6 border-b border-gray-100">
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
                  Skill Matrix
                </p>
                <div className="grid grid-cols-2 gap-8">
                  {/* Matches */}
                  <div>
                    <p className="font-sans text-xs font-medium text-green-700 uppercase tracking-widest mb-3">
                      Matches Found
                    </p>
                    <ul className="space-y-2.5">
                      {getSkillMatches(job.company).map((skill) => (
                        <li key={skill} className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-4 h-4 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                            <Check size={9} className="text-green-700" strokeWidth={2.5} />
                          </span>
                          <span className="font-sans text-sm text-gray-700">{skill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Gaps */}
                  <div>
                    <p className="font-sans text-xs font-medium text-amber-700 uppercase tracking-widest mb-3">
                      Missing / Weak
                    </p>
                    <ul className="space-y-2.5">
                      {getSkillGaps(job.company).map((gap) => (
                        <li key={gap} className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                            <AlertTriangle size={8} className="text-amber-600" strokeWidth={2.5} />
                          </span>
                          <span className="font-sans text-sm text-gray-600">{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* ── 4. Execution Plan ── */}
              <div className="px-8 py-6">
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
                  Execution Plan
                </p>
                <ul className="space-y-4">
                  {EXECUTION_PLAN.map(({ Icon, text, type }, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span
                        className={`mt-0.5 w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${
                          type === "warn"
                            ? "bg-amber-50 border border-amber-200"
                            : "bg-gray-100 border border-gray-200"
                        }`}
                      >
                        <Icon
                          size={13}
                          strokeWidth={1.5}
                          className={type === "warn" ? "text-amber-600" : "text-gray-500"}
                        />
                      </span>
                      <p
                        className={`font-sans text-sm leading-relaxed ${
                          type === "warn" ? "text-amber-700" : "text-gray-700"
                        }`}
                      >
                        {text}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── 5. Sticky Footer ── */}
            <div className="shrink-0 bg-white border-t border-gray-100 px-8 py-5 flex items-center justify-end gap-3">
              <button
                onClick={handleReject}
                className="px-5 py-2.5 bg-white text-gray-600 font-sans font-medium text-sm rounded-sm border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors"
              >
                Reject Job
              </button>
              <button
                onClick={handleApprove}
                className="px-6 py-2.5 bg-[#0A0A0A] text-white font-sans font-medium text-sm rounded-full hover:bg-gray-800 transition-colors"
              >
                Approve & Queue
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
