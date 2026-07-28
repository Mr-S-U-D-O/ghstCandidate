import React, { useState, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, CheckCircle2, Loader2, X, FileText } from 'lucide-react'
import { UserContext } from '../context/UserContext'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

// ── Helper: Transition Wrapper ──────────────────────────────────────

interface StepContainerProps {
  stepIndex: number
  currentStep: number
  children: React.ReactNode
}

const StepContainer = ({ stepIndex, currentStep, children }: StepContainerProps) => {
  const isCurrent = currentStep === stepIndex
  const isPast = currentStep > stepIndex

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center p-6 transition-all duration-700 ease-in-out"
      style={{
        opacity: isCurrent ? 1 : 0,
        transform: isCurrent ? 'translateY(0)' : isPast ? 'translateY(-3rem)' : 'translateY(3rem)',
        pointerEvents: isCurrent ? 'auto' : 'none',
        zIndex: isCurrent ? 10 : 0
      }}
    >
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center">
        {children}
      </div>
    </div>
  )
}

// ── Upload Card ─────────────────────────────────────────────────────

interface UploadCardProps {
  state: 'idle' | 'uploading' | 'done' | 'error'
  error?: string
  label: string
  icon: React.ReactNode
  onClickUpload: () => void
}

const UploadCard = ({ state, error, label, icon, onClickUpload }: UploadCardProps) => (
  <div
    onClick={onClickUpload}
    className={`w-full max-w-md h-48 md:h-64 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
      state === 'idle'
        ? 'border-gray-300 hover:border-black hover:bg-gray-50'
        : state === 'uploading'
        ? 'border-black bg-gray-50'
        : state === 'error'
        ? 'border-red-500 bg-red-50'
        : 'border-green-500 bg-green-50'
    }`}
  >
    {(state === 'idle' || state === 'error') && (
      <>
        <div className={state === 'error' ? 'text-red-400 mb-4' : 'text-gray-400 mb-4'}>{icon}</div>
        <p className={`font-sans text-base font-medium ${state === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
          {state === 'error' ? (error ?? 'An error occurred.') : label}
        </p>
      </>
    )}
    {state === 'uploading' && (
      <>
        <Loader2 size={40} className="text-black animate-spin mb-4" />
        <p className="font-sans text-base font-medium text-black">Ghost is reading your document...</p>
      </>
    )}
    {state === 'done' && (
      <>
        <CheckCircle2 size={48} className="text-green-600 mb-4" />
        <p className="font-sans text-base font-medium text-green-700">Parsed successfully!</p>
      </>
    )}
  </div>
)

// ── Main Component ───────────────────────────────────────────────────

export default function OnboardingFlow() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const totalSteps = 6

  const { candidateProfile, setCandidateProfile, syncProfile } = useContext(UserContext)

  // ── Step 1: Name ────────────────────────────────────────────────
  const [nameInput, setNameInput] = useState(candidateProfile.name || '')
  const handleNameSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && nameInput.trim()) {
      setCandidateProfile((p) => ({ ...p, name: nameInput.trim() }))
      setStep(2)
    }
  }

  // ── Step 2: CV Upload ───────────────────────────────────────────
  const [cvUploadState, setCvUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [cvUploadError, setCvUploadError] = useState('')
  const cvFileInputRef = useRef<HTMLInputElement>(null)

  const handleCvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCvUploadState('uploading')
    setCvUploadError('')

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string
        const res = await fetch(`${API_BASE_URL}/api/parse-cv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Pdf: base64Data })
        })
        const data = await res.json()

        if (!data.isValid) {
          setCvUploadState('error')
          setCvUploadError("This doesn't look like a CV. Please try again.")
          if (cvFileInputRef.current) cvFileInputRef.current.value = ''
          return
        }

        setCandidateProfile(p => ({
          ...p,
          name: data.name || p.name,
          email: data.email || p.email,
          skills: data.skills || p.skills,
          targetRoles: data.targetRoles || p.targetRoles,
          locations: data.locations || p.locations,
          rawResumeText: data.experienceSummary || p.rawResumeText
        }))

        setCvUploadState('done')
        setTimeout(() => setStep(3), 1000)
      }
      reader.readAsDataURL(file)
    } catch (_err) {
      setCvUploadState('error')
      setCvUploadError('An error occurred during parsing.')
      if (cvFileInputRef.current) cvFileInputRef.current.value = ''
    }
  }

  // ── Step 3: Cover Letter Upload ─────────────────────────────────
  const [clUploadState, setClUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [clUploadError, setClUploadError] = useState('')
  const clFileInputRef = useRef<HTMLInputElement>(null)

  const handleClFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setClUploadState('uploading')
    setClUploadError('')

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string
        // Reuse parse-cv endpoint — Gemini reads the PDF and extracts its text
        const res = await fetch(`${API_BASE_URL}/api/parse-cv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Pdf: base64Data, mode: 'cover_letter' })
        })
        const data = await res.json()

        // We treat any PDF as valid for a cover letter — just grab the raw text summary
        const extractedText = data.experienceSummary || data.rawText || ''
        setCandidateProfile(p => ({
          ...p,
          rawCoverLetterText: extractedText
        }))

        setClUploadState('done')
        setTimeout(() => setStep(4), 1000)
      }
      reader.readAsDataURL(file)
    } catch (_err) {
      setClUploadState('error')
      setClUploadError('An error occurred during parsing.')
      if (clFileInputRef.current) clFileInputRef.current.value = ''
    }
  }

  // ── Step 4: Target Roles ────────────────────────────────────────
  const [roleInput, setRoleInput] = useState('')
  const handleRoleAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && roleInput.trim()) {
      e.preventDefault()
      if (!candidateProfile.targetRoles.includes(roleInput.trim())) {
        setCandidateProfile((p) => ({ ...p, targetRoles: [...p.targetRoles, roleInput.trim()] }))
      }
      setRoleInput('')
    }
  }
  const removeRole = (role: string) => {
    setCandidateProfile((p) => ({ ...p, targetRoles: p.targetRoles.filter((r) => r !== role) }))
  }

  // ── Step 5: Work Type / Location ────────────────────────────────
  const [workType, setWorkType] = useState<'Remote' | 'Hybrid' | 'On-site' | ''>('')
  const [cityInput, setCityInput] = useState('')
  const handleWorkTypeSelect = (type: 'Remote' | 'Hybrid' | 'On-site') => {
    setWorkType(type)
    if (type === 'Remote') {
      setTimeout(() => setStep(6), 400)
    }
  }
  const handleCitySubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && cityInput.trim()) {
      if (!candidateProfile.locations.includes(cityInput.trim())) {
        setCandidateProfile((p) => ({ ...p, locations: [...p.locations, cityInput.trim()] }))
      }
      setStep(6)
    }
  }

  // ── Step 6: Completion ──────────────────────────────────────────
  const handleFinish = async () => {
    await syncProfile()
    navigate('/dashboard')
  }

  return (
    <div className="relative w-screen h-screen bg-white text-[#0A0A0A] overflow-hidden">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gray-100 z-50">
        <div
          className="h-full bg-black transition-all duration-700 ease-out"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        ></div>
      </div>

      {/* Step counter */}
      <div className="absolute top-4 right-6 z-50 font-sans text-xs text-gray-400">
        {step} / {totalSteps}
      </div>

      {/* ── Step 1: Name ── */}
      <StepContainer stepIndex={1} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl mb-12 tracking-tight">
          Let's get started. What's your full name?
        </h2>
        <input
          type="text"
          autoFocus={step === 1}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={handleNameSubmit}
          placeholder="e.g. Jane Doe"
          className="w-full max-w-lg text-center font-sans text-2xl md:text-3xl text-black placeholder:text-gray-300 bg-transparent border-b-2 border-black focus:outline-none py-2 transition-colors"
        />
        <p className="mt-8 font-sans text-sm text-gray-400">Press Enter ↵ to continue</p>
      </StepContainer>

      {/* ── Step 2: CV Upload ── */}
      <StepContainer stepIndex={2} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-12 tracking-tight">
          Upload your master CV. We'll extract the rest.
        </h2>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={cvFileInputRef}
          onChange={handleCvFileChange}
        />
        <UploadCard
          state={cvUploadState}
          error={cvUploadError}
          label="Drop your CV PDF here, or click to browse."
          icon={<UploadCloud size={48} strokeWidth={1.5} />}
          onClickUpload={() => { if (cvUploadState !== 'uploading') cvFileInputRef.current?.click() }}
        />
        {cvUploadState === 'idle' && (
          <button
            onClick={() => setStep(3)}
            className="mt-8 font-sans text-sm text-gray-400 hover:text-black underline underline-offset-2 transition-colors"
          >
            Skip for now
          </button>
        )}
      </StepContainer>

      {/* ── Step 3: Cover Letter Upload ── */}
      <StepContainer stepIndex={3} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4 tracking-tight">
          Upload an original cover letter.
        </h2>
        <p className="font-sans text-base text-gray-500 mb-10 max-w-md leading-relaxed">
          The Ghost uses this as a style reference to write bespoke cover letters that sound exactly like you.
        </p>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={clFileInputRef}
          onChange={handleClFileChange}
        />
        <UploadCard
          state={clUploadState}
          error={clUploadError}
          label="Drop your Cover Letter PDF here, or click to browse."
          icon={<FileText size={48} strokeWidth={1.5} />}
          onClickUpload={() => { if (clUploadState !== 'uploading') clFileInputRef.current?.click() }}
        />
        <button
          onClick={() => setStep(4)}
          className="mt-8 font-sans text-sm text-gray-400 hover:text-black underline underline-offset-2 transition-colors"
        >
          Skip for now
        </button>
      </StepContainer>

      {/* ── Step 4: Target Roles ── */}
      <StepContainer stepIndex={4} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-12 tracking-tight">
          What roles are you hunting for?
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 min-h-[40px]">
          {candidateProfile.targetRoles.map((role) => (
            <div
              key={role}
              className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 border border-gray-200 rounded-full font-sans text-sm text-[#0A0A0A]"
            >
              {role}
              <button onClick={() => removeRole(role)} className="text-gray-400 hover:text-black transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <input
          type="text"
          value={roleInput}
          onChange={(e) => setRoleInput(e.target.value)}
          onKeyDown={handleRoleAdd}
          placeholder="e.g. Frontend Engineer"
          className="w-full max-w-lg text-center font-sans text-xl md:text-2xl text-black placeholder:text-gray-300 bg-transparent border-b-2 border-black focus:outline-none py-2 transition-colors"
        />
        <p className="mt-8 font-sans text-sm text-gray-400">Press Enter ↵ to add.</p>

        {candidateProfile.targetRoles.length > 0 && (
          <button
            onClick={() => setStep(5)}
            className="mt-8 px-8 py-3 bg-[#0A0A0A] text-white rounded-full font-sans font-medium hover:bg-gray-800 transition-colors"
          >
            Next Step
          </button>
        )}
      </StepContainer>

      {/* ── Step 5: Work Type / Location ── */}
      <StepContainer stepIndex={5} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-12 tracking-tight">
          Where do you want to work?
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          {(['Remote', 'Hybrid', 'On-site'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleWorkTypeSelect(type)}
              className={`px-8 py-6 rounded-xl border-2 transition-all font-heading font-bold text-lg ${
                workType === type
                  ? 'border-black text-black bg-gray-50 shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div
          className={`w-full max-w-lg mt-12 transition-all duration-500 ease-in-out ${
            workType === 'Hybrid' || workType === 'On-site'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <p className="font-sans text-sm font-medium text-gray-500 mb-4 uppercase tracking-widest">Which city?</p>
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={handleCitySubmit}
            placeholder="e.g. San Francisco, CA"
            className="w-full text-center font-sans text-xl md:text-2xl text-black placeholder:text-gray-300 bg-transparent border-b-2 border-black focus:outline-none py-2 transition-colors"
          />
          <p className="mt-8 font-sans text-sm text-gray-400">Press Enter ↵ to continue</p>
        </div>
      </StepContainer>

      {/* ── Step 6: Complete ── */}
      <StepContainer stepIndex={6} currentStep={step}>
        <div className="w-16 h-16 bg-[#0A0A0A] rounded-full flex items-center justify-center mb-8 mx-auto">
          <CheckCircle2 size={32} className="text-white" strokeWidth={2} />
        </div>
        <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6 tracking-tight">
          Your Ghost is ready.
        </h2>
        <p className="font-sans text-lg text-gray-500 max-w-md mx-auto leading-relaxed mb-10">
          We've built your profile. Now let's put it to work and start finding your next role.
        </p>
        <button
          onClick={handleFinish}
          className="px-10 py-4 bg-[#0A0A0A] text-white rounded-full font-sans font-medium text-lg hover:bg-gray-800 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-black"
        >
          Go to Dashboard
        </button>
      </StepContainer>

    </div>
  )
}
