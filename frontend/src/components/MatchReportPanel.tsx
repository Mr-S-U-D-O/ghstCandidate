import React, { useState } from "react"
import { X, FileText, Check, AlertTriangle, MapPin, Clock, ExternalLink, Loader2 } from "lucide-react"
import type { Job } from "./Dashboard"
import { UserContext } from "../context/UserContext"
import { supabase } from "../supabaseClient"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

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
  const { candidateProfile, user } = React.useContext(UserContext)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bottleneck UI state
  const [needsInputQuestion, setNeedsInputQuestion] = useState<string | null>(null)
  const [requiresLogin, setRequiresLogin] = useState(false)
  const [jitAnswer, setJitAnswer] = useState('')
  const [isSavingAnswer, setIsSavingAnswer] = useState(false)

  const handleApprove = async () => {
    console.log("[MatchReportPanel] handleRunAgent clicked for job ID:", job?.id)
    if (!job) return
    setIsApplying(true)
    setError(null)
    setNeedsInputQuestion(null)
    setRequiresLogin(false)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${API_BASE_URL}/api/run-agent`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          jobId: job.id,
          jobUrl: job.sourceUrl || "",
          candidateProfile: candidateProfile || {},
          userId: user?.id,
          jobTitle: job.title,
          company: job.company
        })
      })

      const data = await res.json()

      if (data.status === 'REQUIRES_LOGIN') {
        console.warn("[MatchReportPanel] REQUIRES_LOGIN — job flagged.")
        setRequiresLogin(true)
        onNeedsInput(job.id, 'requires_manual_login')
        return
      }

      if (data.status === 'NEEDS_INPUT' && data.missingField) {
        console.warn("[MatchReportPanel] NEEDS_INPUT —", data.missingField)
        setNeedsInputQuestion(data.missingField)
        onNeedsInput(job.id, data.missingField)
        return
      }

      if (!res.ok) {
        throw new Error(data.message ?? "Agent returned an error.")
      }

      onApprove(job.id)
      onClose()
    } catch (err) {
      setError("The Ghost encountered an error. Check backend logs.")
      console.error(err)
    } finally {
      setIsApplying(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!job || !jitAnswer.trim() || !needsInputQuestion) return
    setIsSavingAnswer(true)
    try {
      // Save the answer to candidate_memories
      await supabase.from('candidate_memories').insert({
        user_id: user?.id,
        memory_key: needsInputQuestion,
        memory_value: jitAnswer.trim(),
        source: 'bottleneck_jit'
      })
      console.log('[MatchReportPanel] JIT answer saved to candidate_memories.')
      setJitAnswer('')
      setNeedsInputQuestion(null)
      // Re-trigger the agent with the new memory now available
      await handleApprove()
    } catch (err) {
      setError("Failed to save your answer. Please try again.")
      console.error(err)
    } finally {
      setIsSavingAnswer(false)
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
      setNeedsInputQuestion(null)
      setRequiresLogin(false)
      setJitAnswer('')
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
        className="fixed top-0 right-0 h-screen w-full md:w-[600px] max-w-full bg-white z-50 flex flex-col"
        style={{
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
            <div className="shrink-0 bg-white border-t border-gray-100 px-8 py-5">

              {/* Login wall banner */}
              {requiresLogin && (
                <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-sans text-sm font-semibold text-amber-800">Login Required</p>
                    <p className="font-sans text-xs text-amber-700 mt-0.5">This job requires you to sign in manually. Click "View Posting" above, sign in, then come back and try again.</p>
                  </div>
                </div>
              )}

              {/* Bottleneck UI — JIT input required */}
              {needsInputQuestion && !requiresLogin && (
                <div className="mb-4 space-y-3">
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-sans text-sm font-semibold text-amber-800">Ghost Blocked</p>
                      <p className="font-sans text-xs text-amber-700 mt-1">The agent encountered a question it couldn't answer:</p>
                      <p className="font-sans text-sm text-amber-900 font-medium mt-1 italic">"{needsInputQuestion}"</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={jitAnswer}
                    onChange={(e) => setJitAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitAnswer() }}
                    placeholder="Type your answer here..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-sm font-sans text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={isSavingAnswer || !jitAnswer.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0A0A0A] text-white font-sans font-medium text-sm rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {isSavingAnswer ? <><Loader2 size={14} className="animate-spin" /> Saving & Resuming Agent...</> : 'Submit Answer & Resume Agent'}
                  </button>
                </div>
              )}

              {/* Error message */}
              <div className="text-red-500 text-sm font-sans mb-3">{error}</div>

              {/* Standard footer actions */}
              {!needsInputQuestion && !requiresLogin && (
                <div className="flex items-center justify-between gap-3">
                  <button onClick={handleReject} disabled={isApplying} className="px-5 py-2.5 bg-white text-gray-600 font-sans font-medium text-sm rounded-sm border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors disabled:opacity-50">
                    Reject Job
                  </button>
                  <button onClick={handleApprove} disabled={isApplying} className="flex items-center gap-2 px-6 py-2.5 bg-[#0A0A0A] text-white font-sans font-medium text-sm rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50">
                    {isApplying ? <><Loader2 size={14} className="animate-spin" /> Ghost is running...</> : 'Generate Documents & Apply'}
                  </button>
                </div>
              )}

              {/* Close button when in a blocked state */}
              {(needsInputQuestion || requiresLogin) && !isApplying && (
                <div className="flex justify-end">
                  <button onClick={handleReject} className="px-5 py-2.5 bg-white text-gray-600 font-sans font-medium text-sm rounded-sm border border-gray-200 hover:border-gray-400 hover:text-gray-800 transition-colors">
                    Reject Job
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
