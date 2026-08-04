import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, CheckCircle2, Loader2, X, FileText } from 'lucide-react'
import { useUser } from '../context/UserContext'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

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
        ? 'border-gray-300 hover:border-orange-500 hover:bg-orange-50/30'
        : state === 'uploading'
        ? 'border-orange-500 bg-orange-50'
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
        <Loader2 size={40} className="text-orange-500 animate-spin mb-4" />
        <p className="font-sans text-base font-medium text-orange-600">Ghost is analyzing your resume...</p>
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

export default function OnboardingFlow() {
  const navigate = useNavigate()
  const { user, candidateProfile, syncProfile } = useUser()
  
  const [step, setStep] = useState(1)
  const totalSteps = 11

  // ── Unified Form State ──────────────────────────────────────────
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    rawResumeText: '',
    rawCoverLetterText: '',
    skills: [] as string[],
    targetRoles: [] as string[],
    locations: [] as string[],
    workType: '',
    
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    auth_to_work: true,
    needs_sponsorship: false,
    felony_conviction: false,
    years_of_experience: '',
    education_level: '',
    highest_degree_major: '',
    salary_expectation: '',
    notice_period: '',
    willing_to_travel: '',
    willing_to_relocate: false,
  })

  // Pre-fill email from Auth or Profile on mount, but let user type their name manually to ensure it saves.
  const hasPrefilled = useRef(false)
  useEffect(() => {
    // Only prefill once to prevent overwriting user input if context updates
    if (hasPrefilled.current) return
    
    // Only proceed if we have loaded at least one of the contexts
    if (!user && !candidateProfile?.email) return
    
    hasPrefilled.current = true

    setFormData(prev => ({
      ...prev,
      email: candidateProfile?.email || user?.email || '',
      first_name: candidateProfile?.first_name || '',
      last_name: candidateProfile?.last_name || '',
      phone: candidateProfile?.phone || '',
      linkedin_url: candidateProfile?.linkedin_url || '',
      github_url: candidateProfile?.github_url || '',
      portfolio_url: candidateProfile?.portfolio_url || '',
      auth_to_work: candidateProfile?.auth_to_work ?? true,
      needs_sponsorship: candidateProfile?.needs_sponsorship ?? false,
      felony_conviction: candidateProfile?.felony_conviction ?? false,
      years_of_experience: candidateProfile?.years_of_experience ? String(candidateProfile.years_of_experience) : '',
      education_level: candidateProfile?.education_level || '',
      highest_degree_major: candidateProfile?.highest_degree_major || '',
      salary_expectation: candidateProfile?.salary_expectation || '',
      notice_period: candidateProfile?.notice_period || '',
      willing_to_travel: candidateProfile?.willing_to_travel || '',
      willing_to_relocate: candidateProfile?.willing_to_relocate ?? false,
      workType: candidateProfile?.work_environment || '',
      targetRoles: candidateProfile?.targetRoles || [],
      locations: candidateProfile?.locations || [],
      skills: candidateProfile?.skills || [],
    }))
  }, [user, candidateProfile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormData(prev => ({ ...prev, [name]: finalValue }))
  }

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1)
  }

  // ── Upload States ───────────────────────────────────────────────
  const [cvUploadState, setCvUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [cvUploadError, setCvUploadError] = useState('')
  const cvFileInputRef = useRef<HTMLInputElement>(null)

  const [clUploadState, setClUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [clUploadError, setClUploadError] = useState('')
  const clFileInputRef = useRef<HTMLInputElement>(null)

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

        if (!res.ok) {
          const status = res.status
          setCvUploadState('error')
          if (status === 413) {
            setCvUploadError('File too large. Please use a PDF under 7MB.')
          } else {
            setCvUploadError(`Upload failed (HTTP ${status}). Please try again.`)
          }
          if (cvFileInputRef.current) cvFileInputRef.current.value = ''
          return
        }

        const data = await res.json()

        if (!data.isValid) {
          setCvUploadState('error')
          setCvUploadError("This doesn't look like a CV. Please try again.")
          if (cvFileInputRef.current) cvFileInputRef.current.value = ''
          return
        }

        setFormData(p => ({
          ...p,
          first_name: p.first_name || (data.name ? data.name.split(' ')[0] : ''),
          last_name: p.last_name || (data.name ? data.name.split(' ').slice(1).join(' ') : ''),
          email: p.email || data.email || '',
          skills: data.skills?.length ? data.skills : p.skills,
          targetRoles: data.targetRoles?.length ? data.targetRoles : p.targetRoles,
          locations: data.locations?.length ? data.locations : p.locations,
          education_level: data.education_level || p.education_level,
          highest_degree_major: data.highest_degree_major || p.highest_degree_major,
          years_of_experience: data.years_of_experience ? String(data.years_of_experience) : p.years_of_experience,
          linkedin_url: data.linkedin_url || p.linkedin_url,
          portfolio_url: data.portfolio_url || p.portfolio_url,
          rawResumeText: data.rawText || data.experienceSummary || p.rawResumeText
        }))

        setCvUploadState('done')
        setTimeout(() => handleNext(), 1000)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('CV upload parsing error:', err)
      setCvUploadState('error')
      setCvUploadError('An error occurred during parsing.')
      if (cvFileInputRef.current) cvFileInputRef.current.value = ''
    }
  }

  const handleClFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setClUploadState('uploading')
    setClUploadError('')

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string
        const res = await fetch(`${API_BASE_URL}/api/parse-cv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Pdf: base64Data, mode: 'cover_letter' })
        })

        if (!res.ok) {
          const status = res.status
          setClUploadState('error')
          if (status === 413) {
            setClUploadError('File too large. Please use a PDF under 7MB.')
          } else {
            setClUploadError(`Upload failed (HTTP ${status}). Please try again.`)
          }
          if (clFileInputRef.current) clFileInputRef.current.value = ''
          return
        }

        const data = await res.json()

        const extractedText = data.experienceSummary || data.rawText || ''
        setFormData(p => ({ ...p, rawCoverLetterText: extractedText }))

        setClUploadState('done')
        setTimeout(() => handleNext(), 1000)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Cover letter upload parsing error:', err)
      setClUploadState('error')
      setClUploadError('An error occurred during parsing.')
      if (clFileInputRef.current) clFileInputRef.current.value = ''
    }
  }

  // ── Step Validations ────────────────────────────────────────────
  const isStep1Valid = !!(formData.first_name.trim() && formData.last_name.trim() && formData.email.trim())
  const isStep2Valid = cvUploadState === 'done'
  const isStep3Valid = clUploadState === 'done'
  const isStep4Valid = formData.targetRoles.length > 0 && formData.skills.length > 0
  
  const isStep5Valid = !!(formData.workType && (formData.workType === 'Remote' || formData.locations.length > 0))
  
  const isLinkedinValid = !formData.linkedin_url || formData.linkedin_url.toLowerCase().includes('linkedin.com')
  const isGithubValid = !formData.github_url || formData.github_url.toLowerCase().includes('github.com')
  
  const isStep7Filled = !!(formData.linkedin_url || formData.github_url || formData.portfolio_url)
  const isStep7ValidForContinue = isStep7Filled && isLinkedinValid && isGithubValid

  const isStep8Filled = !!(formData.years_of_experience) // Only based on input typing
  const isStep9Filled = !!(formData.education_level || formData.highest_degree_major)
  const isStep10Filled = !!(formData.salary_expectation || formData.notice_period || formData.willing_to_travel || formData.willing_to_relocate)

  // ── Final Save ──────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false)
  
  const handleFinish = async () => {
    setIsSaving(true)
    try {
      await syncProfile({
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        
        rawResumeText: formData.rawResumeText,
        rawCoverLetterText: formData.rawCoverLetterText,
        skills: formData.skills,
        targetRoles: formData.targetRoles,
        locations: formData.locations,
        work_environment: formData.workType, // mapping Work Type to work_environment
        
        linkedin_url: formData.linkedin_url,
        github_url: formData.github_url,
        portfolio_url: formData.portfolio_url,
        auth_to_work: formData.auth_to_work,
        needs_sponsorship: formData.needs_sponsorship,
        years_of_experience: formData.years_of_experience ? Number(formData.years_of_experience) : undefined,
        education_level: formData.education_level,
        highest_degree_major: formData.highest_degree_major,
        salary_expectation: formData.salary_expectation,
        notice_period: formData.notice_period,
        willing_to_travel: formData.willing_to_travel,
        willing_to_relocate: formData.willing_to_relocate,
      })
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to save profile', err)
      setIsSaving(false)
    }
  }

  // ── Common UI Elements ──────────────────────────────────────────
  const ContinueButton = ({ isValid, onClick }: { isValid: boolean, onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`w-full max-w-sm mx-auto py-4 mt-8 bg-orange-500 text-white font-sans font-medium rounded-lg hover:bg-orange-600 transition-all duration-300 ${
        isValid ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute'
      }`}
    >
      Continue
    </button>
  )

  const SkipButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full max-w-sm mx-auto py-3 mt-4 text-sm text-gray-400 hover:text-orange-500 transition-colors bg-transparent border-none block font-sans"
    >
      Skip for now
    </button>
  )
  
  // Progress bar widths
  const blackWidth = `${(Math.min(step, 5) / totalSteps) * 100}%`
  const orangeWidth = `${(Math.max(0, step - 5) / totalSteps) * 100}%`

  // Role addition logic
  const [roleInput, setRoleInput] = useState('')
  const handleRoleAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && roleInput.trim()) {
      e.preventDefault()
      if (!formData.targetRoles.includes(roleInput.trim())) {
        setFormData(p => ({ ...p, targetRoles: [...p.targetRoles, roleInput.trim()] }))
      }
      setRoleInput('')
    }
  }
  const removeRole = (role: string) => {
    setFormData(p => ({ ...p, targetRoles: p.targetRoles.filter(r => r !== role) }))
  }

  // Skill addition logic
  const [skillInput, setSkillInput] = useState('')
  const handleSkillAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault()
      if (!formData.skills.includes(skillInput.trim())) {
        setFormData(p => ({ ...p, skills: [...p.skills, skillInput.trim()] }))
      }
      setSkillInput('')
    }
  }
  const removeSkill = (skill: string) => {
    setFormData(p => ({ ...p, skills: p.skills.filter(s => s !== skill) }))
  }
  
  // Location logic
  const [cityInput, setCityInput] = useState('')
  const handleCitySubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && cityInput.trim()) {
      e.preventDefault()
      if (!formData.locations.includes(cityInput.trim())) {
        setFormData(p => ({ ...p, locations: [...p.locations, cityInput.trim()] }))
      }
      setCityInput('')
    }
  }
  const removeLocation = (loc: string) => {
    setFormData(p => ({ ...p, locations: p.locations.filter(l => l !== loc) }))
  }

  return (
    <div className="relative w-screen h-screen bg-white text-[#0A0A0A] overflow-hidden">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gray-100 flex z-50">
        <div className="h-full bg-black transition-all duration-700 ease-out" style={{ width: blackWidth }} />
        <div className="h-full bg-orange-500 transition-all duration-700 ease-out" style={{ width: orangeWidth }} />
      </div>

      {/* Step counter */}
      <div className="absolute top-4 right-6 z-50 font-sans text-xs text-gray-400 uppercase tracking-widest">
        Step <span className="text-orange-500 font-bold">{step}</span> of <span className="text-orange-500 font-bold">{totalSteps}</span>
      </div>

      {/* ── Step 1: Basic Info ── */}
      <StepContainer stepIndex={1} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl mb-2 tracking-tight">
          Let's get started.
        </h2>
        <p className="font-sans text-gray-500 mb-10 text-center">First, we need your basic details.</p>
        
        <div className="w-full max-w-sm space-y-5 text-left font-sans">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                First Name <span className="text-red-500 font-bold">*</span>
              </label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="Jane" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
                Last Name <span className="text-red-500 font-bold">*</span>
              </label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
              Email <span className="text-red-500 font-bold">*</span>
            </label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="jane@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">
              Phone
            </label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="+1 (555) 000-0000" />
          </div>
        </div>

        <ContinueButton isValid={isStep1Valid} onClick={handleNext} />
      </StepContainer>

      {/* ── Step 2: CV Upload ── */}
      <StepContainer stepIndex={2} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4 tracking-tight">
          Upload your Master CV <span className="text-red-500 align-top text-2xl leading-none">*</span>
        </h2>
        <p className="font-sans text-base text-gray-500 mb-10 max-w-md leading-relaxed text-center">
          This is strictly required. Ghost needs this to generate tailored resumes.
        </p>
        
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

        <ContinueButton isValid={isStep2Valid} onClick={handleNext} />
      </StepContainer>

      {/* ── Step 3: Cover Letter Upload ── */}
      <StepContainer stepIndex={3} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4 tracking-tight">
          Upload your Cover Letter
        </h2>
        <p className="font-sans text-base text-gray-500 mb-10 max-w-md leading-relaxed text-center">
          Optional. Ghost uses this as a style reference to sound exactly like you.
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

        <ContinueButton isValid={isStep3Valid} onClick={handleNext} />
        <SkipButton onClick={handleNext} />
      </StepContainer>

      {/* ── Step 4: Target Roles ── */}
      <StepContainer stepIndex={4} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4 tracking-tight">
          What roles are you hunting for? <span className="text-red-500 align-top text-2xl leading-none">*</span>
        </h2>
        <p className="font-sans text-base text-gray-500 mb-8 max-w-md leading-relaxed text-center">
          Add at least one role to proceed.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 min-h-[40px] max-w-lg">
          {formData.targetRoles.map((role) => (
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
          placeholder="e.g. Frontend Engineer (Press Enter)"
          className="w-full max-w-lg text-center font-sans text-xl md:text-2xl text-black placeholder:text-gray-300 bg-transparent border-b-2 border-gray-300 focus:border-orange-500 focus:outline-none py-2 mb-12 transition-colors"
        />

        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-4 tracking-tight mt-4">
          What are your top skills? <span className="text-red-500 align-top text-2xl leading-none">*</span>
        </h2>
        <p className="font-sans text-base text-gray-500 mb-8 max-w-md leading-relaxed text-center">
          Add a few skills so we can better match you.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 min-h-[40px] max-w-lg">
          {formData.skills.map((skill) => (
            <div
              key={skill}
              className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 border border-gray-200 rounded-full font-sans text-sm text-[#0A0A0A]"
            >
              {skill}
              <button onClick={() => removeSkill(skill)} className="text-gray-400 hover:text-black transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <input
          type="text"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleSkillAdd}
          placeholder="e.g. React, Python, Figma (Press Enter)"
          className="w-full max-w-lg text-center font-sans text-xl md:text-2xl text-black placeholder:text-gray-300 bg-transparent border-b-2 border-gray-300 focus:border-orange-500 focus:outline-none py-2 transition-colors"
        />

        <ContinueButton isValid={isStep4Valid} onClick={handleNext} />
      </StepContainer>

      {/* ── Step 5: Work Preferences ── */}
      <StepContainer stepIndex={5} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-12 tracking-tight">
          Where do you want to work? <span className="text-red-500 align-top text-2xl leading-none">*</span>
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          {(['Remote', 'Hybrid', 'On-site'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFormData(p => ({ ...p, workType: type }))}
              className={`px-8 py-6 rounded-xl border-2 transition-all font-heading font-bold text-lg ${
                formData.workType === type
                  ? 'border-orange-500 text-orange-500 bg-orange-50 shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:border-orange-200 hover:bg-orange-50/50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div
          className={`w-full max-w-lg mt-12 transition-all duration-500 ease-in-out ${
            formData.workType === 'Hybrid' || formData.workType === 'On-site'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none absolute'
          }`}
        >
          <p className="font-sans text-sm font-bold text-gray-800 mb-4 uppercase tracking-widest text-left">
            Which city? <span className="text-red-500 font-bold">*</span>
          </p>
          
          <div className="flex flex-wrap items-center justify-start gap-2 mb-4 min-h-[40px]">
            {formData.locations.map((loc) => (
              <div key={loc} className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 border border-gray-200 rounded-full font-sans text-sm text-[#0A0A0A]">
                {loc}
                <button onClick={() => removeLocation(loc)} className="text-gray-400 hover:text-black transition-colors"><X size={14} /></button>
              </div>
            ))}
          </div>

          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={handleCitySubmit}
            placeholder="e.g. San Francisco, CA (Press Enter)"
            className="w-full text-left font-sans text-xl md:text-2xl text-black placeholder:text-gray-300 bg-transparent border-b-2 border-gray-300 focus:border-orange-500 focus:outline-none py-2 transition-colors"
          />
        </div>

        <ContinueButton isValid={isStep5Valid} onClick={handleNext} />
      </StepContainer>

      {/* ── Step 6: The Interstitial ── */}
      <StepContainer stepIndex={6} currentStep={step}>
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-[#0A0A0A] mb-4">Unlock Autonomous Applications</h1>
        <p className="font-sans text-gray-600 leading-relaxed mb-10 max-w-md mx-auto">
          The next few questions are technically optional, but they are crucial. If you skip them, the AI will pause your applications when it encounters an ATS question it doesn't know the answer to.
          <br /><br />
          If you answer them now, the AI can apply to jobs for you completely autonomously while you sleep.
        </p>
        
        <button onClick={handleNext} className="w-full max-w-sm mx-auto py-4 bg-orange-500 text-white font-sans font-medium rounded-lg hover:bg-orange-600 transition-colors shadow-xl shadow-orange-500/20">
          Let's do it
        </button>
      </StepContainer>

      {/* ── Step 7: Links (Part 2) ── */}
      <StepContainer stepIndex={7} currentStep={step}>
        <h1 className="font-heading text-3xl font-bold text-[#0A0A0A] mb-2 text-center">Your Links</h1>
        <p className="font-sans text-gray-500 text-center mb-10">Where can employers see your work?</p>
        
        <div className="w-full max-w-sm space-y-5 text-left font-sans">
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">LinkedIn Profile</label>
            <input type="url" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="https://linkedin.com/in/..." />
            {!isLinkedinValid && (
              <p className="text-red-500 text-xs mt-1.5 font-bold">Please provide a valid LinkedIn URL.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">GitHub Profile</label>
            <input type="url" name="github_url" value={formData.github_url} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="https://github.com/..." />
            {!isGithubValid && (
              <p className="text-red-500 text-xs mt-1.5 font-bold">Please provide a valid GitHub URL.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">Portfolio / Personal Website</label>
            <input type="url" name="portfolio_url" value={formData.portfolio_url} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="https://..." />
          </div>
        </div>

        <ContinueButton isValid={isStep7ValidForContinue} onClick={handleNext} />
        <SkipButton onClick={handleNext} />
      </StepContainer>

      {/* ── Step 8: Legal & YoE (Part 2) ── */}
      <StepContainer stepIndex={8} currentStep={step}>
        <h1 className="font-heading text-3xl font-bold text-[#0A0A0A] mb-2 text-center">Experience & Eligibility</h1>
        <p className="font-sans text-gray-500 text-center mb-10">Standard ATS screening questions.</p>
        
        <div className="w-full max-w-md space-y-6 text-left font-sans">
          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-sm font-bold text-[#0A0A0A] pr-4">Are you legally authorized to work in the country you are applying in?</span>
            <input type="checkbox" name="auth_to_work" checked={formData.auth_to_work} onChange={handleChange} className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0" />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-sm font-bold text-[#0A0A0A] pr-4">Do you now, or will you in the future, require sponsorship for employment visa status?</span>
            <input type="checkbox" name="needs_sponsorship" checked={formData.needs_sponsorship} onChange={handleChange} className="w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0" />
          </div>
          <div className="flex flex-col p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-sm font-bold text-[#0A0A0A] mb-3">Have you ever been convicted of a felony?</span>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="felony_conviction" checked={formData.felony_conviction === true} onChange={() => setFormData(p => ({ ...p, felony_conviction: true }))} className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-gray-700 font-medium">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="felony_conviction" checked={formData.felony_conviction === false} onChange={() => setFormData(p => ({ ...p, felony_conviction: false }))} className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-gray-700 font-medium">No</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">Years of Professional Experience</label>
            <input type="number" name="years_of_experience" value={formData.years_of_experience} onChange={handleChange} min="0" className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="e.g. 5" />
          </div>
        </div>

        <ContinueButton isValid={isStep8Filled} onClick={handleNext} />
        <SkipButton onClick={handleNext} />
      </StepContainer>

      {/* ── Step 9: Education (Part 2) ── */}
      <StepContainer stepIndex={9} currentStep={step}>
        <h1 className="font-heading text-3xl font-bold text-[#0A0A0A] mb-2 text-center">Education</h1>
        <p className="font-sans text-gray-500 text-center mb-10">Your academic background.</p>
        
        <div className="w-full max-w-sm space-y-5 text-left font-sans">
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">Highest Level of Education</label>
            <select name="education_level" value={formData.education_level} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 transition-colors appearance-none">
              <option value="">Select level...</option>
              <option value="High School">High School / GED</option>
              <option value="Associate's Degree">Associate's Degree</option>
              <option value="Bachelor's Degree">Bachelor's Degree</option>
              <option value="Master's Degree">Master's Degree</option>
              <option value="Doctorate (PhD)">Doctorate (PhD)</option>
              <option value="Self-Taught / Bootcamp">Self-Taught / Bootcamp</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">Major / Field of Study</label>
            <input type="text" name="highest_degree_major" value={formData.highest_degree_major} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="e.g. Computer Science" />
          </div>
        </div>

        <ContinueButton isValid={isStep9Filled} onClick={handleNext} />
        <SkipButton onClick={handleNext} />
      </StepContainer>

      {/* ── Step 10: Logistics (Part 2) ── */}
      <StepContainer stepIndex={10} currentStep={step}>
        <h1 className="font-heading text-3xl font-bold text-[#0A0A0A] mb-2 text-center">Logistics</h1>
        <p className="font-sans text-gray-500 text-center mb-10">Preferences and availability.</p>
        
        <div className="w-full max-w-md space-y-5 text-left font-sans">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">Salary Expectation</label>
              <input type="text" name="salary_expectation" value={formData.salary_expectation} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="e.g. $120k" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">Notice Period</label>
              <input type="text" name="notice_period" value={formData.notice_period} onChange={handleChange} className="w-full py-3 bg-transparent border-b border-black outline-none focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors placeholder-gray-400" placeholder="e.g. 2 weeks" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1.5 uppercase tracking-wide">Willing to Travel</label>
            <select name="willing_to_travel" value={formData.willing_to_travel} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 transition-colors appearance-none">
              <option value="">Select...</option>
              <option value="No">No</option>
              <option value="Up to 25%">Up to 25%</option>
              <option value="Up to 50%">Up to 50%</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg mt-4">
            <span className="text-sm font-bold text-[#0A0A0A]">Are you willing to relocate for this role?</span>
            <input type="checkbox" name="willing_to_relocate" checked={formData.willing_to_relocate} onChange={handleChange} className="w-5 h-5 accent-orange-500 cursor-pointer" />
          </div>
        </div>

        <ContinueButton isValid={isStep10Filled} onClick={handleNext} />
        <SkipButton onClick={handleNext} />
      </StepContainer>

      {/* ── Step 11: Complete ── */}
      <StepContainer stepIndex={11} currentStep={step}>
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-orange-500" strokeWidth={2} />
        </div>
        <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6 tracking-tight">
          Your Ghost is ready.
        </h2>
        <p className="font-sans text-lg text-gray-500 max-w-md mx-auto leading-relaxed mb-10">
          Your autonomous AI brain is now fully loaded. You can change these answers later in your Profile settings.
        </p>
        <button
          onClick={handleFinish}
          disabled={isSaving}
          className="px-10 py-4 bg-orange-500 text-white rounded-full font-sans font-bold text-lg hover:bg-orange-600 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20"
        >
          {isSaving && <Loader2 size={20} className="animate-spin" />}
          {isSaving ? 'Saving Profile...' : 'Save & Go to Dashboard'}
        </button>
      </StepContainer>

    </div>
  )
}
