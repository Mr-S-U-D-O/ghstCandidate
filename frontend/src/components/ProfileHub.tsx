import React, { useState, useEffect, useRef } from 'react'
import { useUser } from '../context/UserContext'
import { supabase } from '../supabaseClient'
import { FileText, Brain, Upload, Plus, Trash2, Download, User } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

type Tab = 'profile' | 'memory' | 'docs'

interface Memory {
  id: string
  memory_key: string
  memory_value: string
  source: string
  created_at: string
}

interface GeneratedDoc {
  id: string
  job_title: string
  company: string
  doc_type: string
  file_path: string
  created_at: string
}

export default function ProfileHub() {
  const { candidateProfile, setCandidateProfile, syncProfile, user } = useUser()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [memories, setMemories] = useState<Memory[]>([])
  const [docs, setDocs] = useState<GeneratedDoc[]>([])

  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isParsingCv, setIsParsingCv] = useState(false)

  useEffect(() => {
    if (activeTab === 'memory') {
      loadMemories()
    } else if (activeTab === 'docs') {
      loadDocs()
    }
  }, [activeTab])

  const loadMemories = async () => {
    if (!user) return
    const { data } = await supabase.from('candidate_memories').select('*').order('created_at', { ascending: false })
    if (data) setMemories(data)
  }

  const loadDocs = async () => {
    if (!user) return
    const { data } = await supabase.from('generated_docs').select('*').order('created_at', { ascending: false })
    if (data) setDocs(data)
  }

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newKey || !newValue) return
    const { data, error } = await supabase.from('candidate_memories').insert({
      user_id: user.id,
      memory_key: newKey,
      memory_value: newValue,
      source: 'user_added'
    }).select().single()
    
    if (!error && data) {
      setMemories([data, ...memories])
      setNewKey('')
      setNewValue('')
    }
  }

  const handleDeleteMemory = async (id: string) => {
    const { error } = await supabase.from('candidate_memories').delete().eq('id', id)
    if (!error) {
      setMemories(memories.filter(m => m.id !== id))
    }
  }

  const handleUpdateCv = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsingCv(true)
    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string
        if (!base64Data) throw new Error('Failed to read file as base64')

        const res = await fetch(`${API_BASE_URL}/api/parse-cv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Pdf: base64Data })
        })

        if (!res.ok) {
          let errorMsg = `Server rejected upload (HTTP ${res.status})`
          try {
            const errorData = await res.json()
            if (errorData?.message) errorMsg = errorData.message
          } catch (e) {
            // ignore
          }
          throw new Error(errorMsg)
        }

        const data = await res.json()
        const merged = { ...candidateProfile, ...data }
        setCandidateProfile(merged)
        await syncProfile(merged)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error("[ProfileHub] Error updating CV:", err)
    } finally {
      setIsParsingCv(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-200 shrink-0">
        <h1 className="font-heading text-2xl font-bold text-[#0A0A0A]">AI Memory & Profile</h1>
        <p className="font-sans text-sm text-gray-500 mt-1">Manage your identity, extracted facts, and custom generated documents.</p>
        
        <div className="flex items-center gap-6 mt-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 font-sans text-sm font-bold border-b-2 transition-all ${activeTab === 'profile' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <span className="flex items-center gap-2"><User size={16} /> My Profile</span>
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`pb-3 font-sans text-sm font-bold border-b-2 transition-all ${activeTab === 'memory' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <span className="flex items-center gap-2"><Brain size={16} /> Ghost Memory</span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`pb-3 font-sans text-sm font-bold border-b-2 transition-all ${activeTab === 'docs' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <span className="flex items-center gap-2"><FileText size={16} /> Document Vault</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-100 p-8 rounded-2xl" style={{ boxShadow: 'var(--shadow-soft)' }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-[#0A0A0A]">Candidate Summary</h2>
                    <p className="font-sans text-sm text-gray-500 mt-1">Core details extracted from your resume.</p>
                  </div>
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  <button 
                    onClick={handleUpdateCv}
                    disabled={isParsingCv}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-sans font-bold rounded-xl hover:border-gray-300 hover:text-gray-900 transition-all shadow-sm disabled:opacity-50"
                  >
                    <Upload size={16} /> {isParsingCv ? "Parsing CV..." : "Update CV"}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans text-sm">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                    <div className="text-[#0A0A0A] font-medium">{candidateProfile.name || 'Not provided'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                    <div className="text-[#0A0A0A] font-medium">{candidateProfile.email || 'Not provided'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Target Roles</label>
                    <div className="text-[#0A0A0A] font-medium">{(candidateProfile.targetRoles || []).join(', ') || 'Not provided'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Locations</label>
                    <div className="text-[#0A0A0A] font-medium">{(candidateProfile.locations || []).join(', ') || 'Not provided'}</div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Top Skills</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(candidateProfile.skills || []).map((skill, i) => (
                        <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-sm border border-gray-200 font-medium">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEMORY BANK */}
          {activeTab === 'memory' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-100 p-8 rounded-2xl" style={{ boxShadow: 'var(--shadow-soft)' }}>
                <h2 className="font-heading text-lg font-bold text-[#0A0A0A] mb-4">Add a Fact</h2>
                <form onSubmit={handleAddMemory} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-sans font-bold text-gray-400 uppercase tracking-wider mb-1">Key</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g., Preferred Framework"
                      value={newKey}
                      onChange={e => setNewKey(e.target.value)}
                      className="w-full py-2 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400 font-sans text-sm"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-xs font-sans font-bold text-gray-400 uppercase tracking-wider mb-1">Value</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g., Tailwind CSS"
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      className="w-full py-2 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400 font-sans text-sm"
                    />
                  </div>
                  <button type="submit" disabled={!newKey || !newValue} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-b from-gray-800 to-[#0A0A0A] text-white font-sans font-bold text-sm rounded-xl hover:from-gray-700 hover:to-gray-900 transition-all disabled:opacity-50 shadow-sm ring-1 ring-white/10 inset-ring">
                    <Plus size={16} /> Add
                  </button>
                </form>
              </div>

              <div className="bg-white border border-gray-100 p-8 rounded-2xl" style={{ boxShadow: 'var(--shadow-soft)' }}>
                {memories.map(m => (
                  <div key={m.id} className="bg-white border border-gray-200 p-4 rounded-xl flex items-start justify-between group shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-4 last:mb-0">
                    <div>
                      <div className="font-heading text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{m.memory_key}</div>
                      <div className="font-sans text-sm text-[#0A0A0A] font-medium">{m.memory_value}</div>
                      <div className="font-sans text-[10px] text-gray-400 mt-3 font-bold uppercase tracking-wider">Source: {m.source}</div>
                    </div>
                    <button 
                      onClick={() => handleDeleteMemory(m.id)}
                      className="text-gray-300 hover:text-[#0A0A0A] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {memories.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-gray-400 font-sans text-sm">No memories recorded yet. Add one above or chat with the Ghost!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENT VAULT */}
          {activeTab === 'docs' && (
            <div className="bg-white border border-gray-100 p-8 rounded-2xl" style={{ boxShadow: 'var(--shadow-soft)' }}>
              <div className="p-6 border-b border-gray-200">
                <h2 className="font-heading text-lg font-bold text-[#0A0A0A]">Generated Documents</h2>
                <p className="font-sans text-sm text-gray-500 mt-1">Custom tailored Resumes and Cover Letters for your applications.</p>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 font-sans text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-3">Job Title</th>
                    <th className="px-6 py-3">Company</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="font-sans text-sm text-gray-700 divide-y divide-gray-100">
                  {docs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-[#0A0A0A]">{doc.job_title}</td>
                      <td className="px-6 py-4">{doc.company}</td>
                      <td className="px-6 py-4 capitalize">{doc.doc_type.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-[#0A0A0A] hover:bg-gray-100 rounded-sm text-xs font-medium transition-colors">
                          <Download size={12} /> View PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                  {docs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-sans text-sm">
                        No documents generated yet. Approve a job to trigger the AI generation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
