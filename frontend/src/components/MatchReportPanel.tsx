import React, { useState } from "react"
import { X, FileText, Check, AlertTriangle, MapPin, Clock, ExternalLink, Loader2 } from "lucide-react"
import type { Job } from "./Dashboard"

// ── Props ─────────────────────────────────────────────────────────

interface MatchReportPanelProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onNeedsInput: (id: string, missingField: string) => void
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

// ── Panel ─────────────────────────────────────────────────────────

export default function MatchReportPanel({ job, isOpen, onClose, onApprove, onReject, onNeedsInput }: MatchReportPanelProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    console.log("[MatchReportPanel] handleApprove clicked for job ID:", job?.id)
    if (!job) return
    setIsApplying(true)
    setError(null)
    
    try {
      const res = await fetch("http://localhost:3001/api/apply-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobUrl: job.sourceUrl || "https://example.com/mock-job",
          candidateProfile: {}
        })
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.status === "NEEDS_INPUT" && data.missingField) {
          // Graceful failure: flag the card and signal Ghost Profiler pulse
          console.warn("[MatchReportPanel] NEEDS_INPUT — missing field:", data.missingField)
          onNeedsInput(job.id, data.missingField)
          setError(`Ghost blocked: "${data.missingField}" is required but missing from your profile. Visit Ghost Profiler to add it.`)
        } else {
          throw new Error(data.message ?? "API error")
        }
        return
      }

      onApprove(job.id)
      onClose()
    } catch (err) {
      setError("Failed to apply. Please try again.")
      console.error(err)
    } finally {
      setIsApplying(false)
    }
  }

  const handleReject  = () => { 
    console.log("[MatchReportPanel] handleReject clicked for job ID:", job?.id)
    if (job) { onReject(job.id); onClose() } 
  }

  // Reset state when opening a new job
  React.useEffect(() => {
    if (isOpen) {
      setIsApplying(false)
      setError(null)
    }
  }, [isOpen, job?.id])

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
        onClick={() => {
          console.log("[MatchReportPanel] Backdrop clicked, closing panel")
          onClose()
        }}
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
              <div className="flex justify-end mb-4">
                <button onClick={onClose} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 font-sans text-sm transition-colors">
                  <X size={16} strokeWidth={1.5} />Close
                </button>
              </div>

              <p className="font-heading font-bold text-lg text-gray-400 mb-1">{job.company}</p>
              <h2 className="font-heading font-bold text-3xl text-[#0A0A0A] leading-tight mb-5">{job.title}</h2>

              <div className="flex items-center gap-2 flex-wrap">
                <MatchBadgeLarge score={job.matchScore} />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-sans text-gray-500 bg-gray-50 border border-gray-200">
                  <MapPin size={13} strokeWidth={1.5} />{job.location}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-sans text-gray-400 bg-gray-50 border border-gray-200">
                  <Clock size={13} strokeWidth={1.5} />{job.postedAgo}
                </span>
                {job.sourceUrl && (
                  <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-sans text-gray-400 bg-gray-50 border border-gray-200 hover:border-gray-400 hover:text-gray-600 transition-colors">
                    <ExternalLink size={13} strokeWidth={1.5} />View Posting
                  </a>
                )}
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="flex-1 overflow-y-auto">

              {/* ── 2. AI Verdict ── */}
              <div className="px-8 py-6 border-b border-gray-100">
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">The Ghost''s Verdict</p>
                <p className="font-sans text-base text-gray-700 leading-relaxed">
                  {job.verdict || "No verdict available."}
                </p>
              </div>

              {/* ── 3. Skill Matrix ── */}
              {(job.matchesFound.length > 0 || job.missingOrWeak.length > 0) && (
                <div className="px-8 py-6 border-b border-gray-100">
                  <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">Skill Matrix</p>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="font-sans text-xs font-medium text-green-700 uppercase tracking-widest mb-3">Matches Found</p>
                      <ul className="space-y-2.5">
                        {job.matchesFound.length > 0 ? job.matchesFound.map((skill) => (
                          <li key={skill} className="flex items-start gap-2.5">
                            <span className="mt-0.5 w-4 h-4 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                              <Check size={9} className="text-green-700" strokeWidth={2.5} />
                            </span>
                            <span className="font-sans text-sm text-gray-700">{skill}</span>
                          </li>
                        )) : (
                          <li className="font-sans text-sm text-gray-400">No specific matches identified</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="font-sans text-xs font-medium text-amber-700 uppercase tracking-widest mb-3">Missing / Weak</p>
                      <ul className="space-y-2.5">
                        {job.missingOrWeak.length > 0 ? job.missingOrWeak.map((gap) => (
                          <li key={gap} className="flex items-start gap-2.5">
                            <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                              <AlertTriangle size={8} className="text-amber-600" strokeWidth={2.5} />
                            </span>
                            <span className="font-sans text-sm text-gray-600">{gap}</span>
                          </li>
                        )) : (
                          <li className="font-sans text-sm text-gray-400">No significant gaps identified</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 4. Execution Plan ── */}
              <div className="px-8 py-6">
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">Execution Plan</p>
                <ul className="space-y-4">
                  {/* Static Ghost actions */}
                  <li className="flex items-start gap-4">
                    <span className="mt-0.5 w-7 h-7 rounded-sm flex items-center justify-center shrink-0 bg-gray-100 border border-gray-200">
                      <FileText size={13} strokeWidth={1.5} className="text-gray-500" />
                    </span>
                    <p className="font-sans text-sm text-gray-700 leading-relaxed">Generating a tailored resume variant based on the matched skills.</p>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="mt-0.5 w-7 h-7 rounded-sm flex items-center justify-center shrink-0 bg-gray-100 border border-gray-200">
                      <Check size={13} strokeWidth={1.5} className="text-gray-500" />
                    </span>
                    <p className="font-sans text-sm text-gray-700 leading-relaxed">Auto-answering standard EEOC and compliance questions.</p>
                  </li>

                  {/* Dynamic human-input warnings from Gemini */}
                  {job.humanInputRequired.map((field) => (
                    <li key={field} className="flex items-start gap-4">
                      <span className="mt-0.5 w-7 h-7 rounded-sm flex items-center justify-center shrink-0 bg-amber-50 border border-amber-200">
                        <AlertTriangle size={13} strokeWidth={1.5} className="text-amber-600" />
                      </span>
                      <p className="font-sans text-sm text-amber-700 leading-relaxed">Will pause for human input on: "{field}"</p>
                    </li>
                  ))}

                  {job.humanInputRequired.length === 0 && (
                    <li className="flex items-start gap-4">
                      <span className="mt-0.5 w-7 h-7 rounded-sm flex items-center justify-center shrink-0 bg-green-50 border border-green-200">
                        <Check size={13} strokeWidth={1.5} className="text-green-700" />
                      </span>
                      <p className="font-sans text-sm text-gray-700 leading-relaxed">No human input required — Ghost will apply fully automatically.</p>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* ── 5. Sticky Footer ── */}
            <div className="shrink-0 bg-white border-t border-gray-100 px-8 py-5 flex items-center justify-between gap-3">
              <div className="text-red-500 text-sm font-sans">{error}</div>
              <div className="flex items-center gap-3">
                <button onClick={handleReject} disabled={isApplying} className="px-5 py-2.5 bg-white text-gray-600 font-sans font-medium text-sm rounded-sm border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors disabled:opacity-50">
                  Reject Job
                </button>
                <button onClick={handleApprove} disabled={isApplying} className="flex items-center gap-2 px-6 py-2.5 bg-[#0A0A0A] text-white font-sans font-medium text-sm rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {isApplying ? <><Loader2 size={14} className="animate-spin" /> Ghost is applying...</> : "Approve & Queue"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
