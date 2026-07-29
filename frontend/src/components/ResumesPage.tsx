import { useState, useEffect } from "react"
import { useUser } from "../context/UserContext"
import { supabase } from "../supabaseClient"
import { ChevronDown, ChevronUp, Download, FileText, Layers, ExternalLink } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────

interface GeneratedDoc {
  id: string
  job_id: string
  job_title: string
  company: string
  doc_type: string
  file_path: string
  changes_made: string
  reasoning: string
  created_at: string
  jobs?: {
    source_url: string
  }
}

// ── Accordion ─────────────────────────────────────────────────────

interface AccordionProps {
  title: string
  subtitle?: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

function Accordion({ title, subtitle, icon, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400">{icon}</span>
          <div>
            <p className="font-heading font-bold text-base text-[#0A0A0A]">{title}</p>
            {subtitle && <p className="font-sans text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {open
          ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
          : <ChevronDown size={16} className="text-gray-400 shrink-0" />
        }
      </button>
      {open && (
        <div className="border-t border-gray-100 px-6 py-5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Tailored Doc Card ─────────────────────────────────────────────

function TailoredDocCard({ doc }: { doc: GeneratedDoc }) {
  const handleDownload = () => {
    if (!doc.file_path) return
    window.open(doc.file_path, "_blank")
  }

  const handleApply = () => {
    const url = doc.jobs?.source_url
    if (!url) return
    window.open(url, "_blank")
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading font-bold text-sm text-[#0A0A0A]">{doc.job_title || "Untitled Role"}</p>
          <p className="font-sans text-xs text-gray-500 mt-0.5">{doc.company || "Unknown Company"}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-sans text-[10px] text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
          {doc.jobs?.source_url && (
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 border border-gray-200 text-xs font-sans font-medium rounded-sm hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={11} />
              Apply to Job
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={!doc.file_path}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0A] text-white text-xs font-sans font-medium rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            <Download size={11} />
            Export PDF
          </button>
        </div>
      </div>

      {doc.changes_made && (
        <div className="border-t border-gray-100 pt-4">
          <p className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Changes Made</p>
          <p className="font-sans text-sm text-gray-700 leading-relaxed">{doc.changes_made}</p>
        </div>
      )}

      {doc.reasoning && (
        <div className="border-t border-gray-100 pt-4">
          <p className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Why These Changes</p>
          <p className="font-sans text-sm text-gray-600 leading-relaxed">{doc.reasoning}</p>
        </div>
      )}

      {!doc.changes_made && !doc.reasoning && (
        <div className="border-t border-gray-100 pt-4">
          <p className="font-sans text-xs text-gray-400 italic">No analysis available for this document.</p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────

export default function ResumesPage() {
  const { candidateProfile, user } = useUser()
  const [resumeDocs, setResumeDocs] = useState<GeneratedDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from("generated_docs")
      .select("*, jobs(source_url)")
      .eq("doc_type", "resume")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setResumeDocs(data ?? [])
        setIsLoading(false)
      })
  }, [user])

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-200 shrink-0">
        <h1 className="font-heading text-2xl font-bold text-[#0A0A0A]">Resumes</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">Your master CV and all Ghost-tailored resume variants.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto space-y-4">

          <Accordion
            title="Original CV"
            subtitle="Parsed text from your uploaded master resume"
            icon={<FileText size={18} />}
            defaultOpen
          >
            {candidateProfile.rawResumeText ? (
              <div className="font-sans text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto pr-2">
                {candidateProfile.rawResumeText}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="font-sans text-sm text-gray-400">
                  No CV uploaded yet. Complete onboarding or re-upload from your profile settings.
                </p>
              </div>
            )}
          </Accordion>

          <Accordion
            title="Tailored Resumes"
            subtitle={`${resumeDocs.length} document${resumeDocs.length !== 1 ? "s" : ""} generated`}
            icon={<Layers size={18} />}
            defaultOpen
          >
            {isLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              </div>
            ) : resumeDocs.length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-sans text-sm text-gray-400">
                  No tailored resumes yet. Approve a job from the Job Tracker to generate your first one.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {resumeDocs.map((doc) => <TailoredDocCard key={doc.id} doc={doc} />)}
              </div>
            )}
          </Accordion>

        </div>
      </div>
    </div>
  )
}
