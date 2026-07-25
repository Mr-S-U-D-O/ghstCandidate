import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, CheckCircle2, Loader2, X } from 'lucide-react'

// ── State Interfaces ─────────────────────────────────────────────

interface Profile {
  name: string
  cvUploaded: boolean
  roles: string[]
  workType: 'Remote' | 'Hybrid' | 'On-site' | ''
  city: string
}

// ── Main Component ───────────────────────────────────────────────

// ── Helper: Transition Wrapper ─────────────────────────────────
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

export default function OnboardingFlow() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const totalSteps = 5

  const [profile, setProfile] = useState<Profile>({
    name: '',
    cvUploaded: false,
    roles: [],
    workType: '',
    city: '',
  })

  // ── Step 1: Basics ─────────────────────────────────────────────
  const [nameInput, setNameInput] = useState('')
  const handleNameSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && nameInput.trim()) {
      setProfile((p) => ({ ...p, name: nameInput.trim() }))
      setStep(2)
    }
  }

  // ── Step 2: Upload ─────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done'>('idle')
  const handleUploadClick = () => {
    if (uploadState !== 'idle') return
    setUploadState('uploading')
    setTimeout(() => {
      setUploadState('done')
      setProfile((p) => ({ ...p, cvUploaded: true }))
      setTimeout(() => setStep(3), 1000)
    }, 1500)
  }

  // ── Step 3: Target ─────────────────────────────────────────────
  const [roleInput, setRoleInput] = useState('')
  const handleRoleAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && roleInput.trim()) {
      e.preventDefault() // prevent form submission if any
      if (!profile.roles.includes(roleInput.trim())) {
        setProfile((p) => ({ ...p, roles: [...p.roles, roleInput.trim()] }))
      }
      setRoleInput('')
    }
  }
  const removeRole = (role: string) => {
    setProfile((p) => ({ ...p, roles: p.roles.filter((r) => r !== role) }))
  }

  // ── Step 4: Logistics ──────────────────────────────────────────
  const [cityInput, setCityInput] = useState('')
  const handleWorkTypeSelect = (type: 'Remote' | 'Hybrid' | 'On-site') => {
    setProfile((p) => ({ ...p, workType: type }))
    if (type === 'Remote') {
      setTimeout(() => setStep(5), 400)
    }
  }
  const handleCitySubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && cityInput.trim()) {
      setProfile((p) => ({ ...p, city: cityInput.trim() }))
      setStep(5)
    }
  }

  // ── Step 5: Completion ─────────────────────────────────────────
  const handleFinish = () => {
    // Navigate to dashboard
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

      {/* --- Step 1 --- */}
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
        <p className="mt-8 font-sans text-sm text-gray-400">
          Press Enter ↵ to continue
        </p>
      </StepContainer>

      {/* --- Step 2 --- */}
      <StepContainer stepIndex={2} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-12 tracking-tight">
          Upload your master CV. We'll extract the rest.
        </h2>
        <div
          onClick={handleUploadClick}
          className={`w-full max-w-md h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
            uploadState === 'idle'
              ? 'border-gray-300 hover:border-black hover:bg-gray-50'
              : uploadState === 'uploading'
              ? 'border-black bg-gray-50'
              : 'border-green-500 bg-green-50'
          }`}
        >
          {uploadState === 'idle' && (
            <>
              <UploadCloud size={48} className="text-gray-400 mb-4" strokeWidth={1.5} />
              <p className="font-sans text-base font-medium text-gray-600">
                Drop your PDF here, or click to browse.
              </p>
            </>
          )}
          {uploadState === 'uploading' && (
            <>
              <Loader2 size={40} className="text-black animate-spin mb-4" />
              <p className="font-sans text-base font-medium text-black">
                Parsing document...
              </p>
            </>
          )}
          {uploadState === 'done' && (
            <>
              <CheckCircle2 size={48} className="text-green-600 mb-4" />
              <p className="font-sans text-base font-medium text-green-700">
                CV successfully parsed!
              </p>
            </>
          )}
        </div>
      </StepContainer>

      {/* --- Step 3 --- */}
      <StepContainer stepIndex={3} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-12 tracking-tight">
          What roles are you hunting for?
        </h2>
        
        {/* Tags container */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 min-h-[40px]">
          {profile.roles.map((role) => (
            <div
              key={role}
              className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 border border-gray-200 rounded-full font-sans text-sm text-[#0A0A0A]"
            >
              {role}
              <button
                onClick={() => removeRole(role)}
                className="text-gray-400 hover:text-black transition-colors"
              >
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
        <p className="mt-8 font-sans text-sm text-gray-400">
          Press Enter ↵ to add.
        </p>

        {profile.roles.length > 0 && (
          <button
            onClick={() => setStep(4)}
            className="mt-8 px-8 py-3 bg-[#0A0A0A] text-white rounded-full font-sans font-medium hover:bg-gray-800 transition-colors whitespace-nowrap"
            style={{ padding: '0.75rem 2rem' }}
          >
            Next Step
          </button>
        )}
      </StepContainer>

      {/* --- Step 4 --- */}
      <StepContainer stepIndex={4} currentStep={step}>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mb-12 tracking-tight">
          Where do you want to work?
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          {['Remote', 'Hybrid', 'On-site'].map((type) => (
            <button
              key={type}
              onClick={() => handleWorkTypeSelect(type as any)}
              className={`px-8 py-6 rounded-xl border-2 transition-all font-heading font-bold text-lg ${
                profile.workType === type
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
            profile.workType === 'Hybrid' || profile.workType === 'On-site'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <p className="font-sans text-sm font-medium text-gray-500 mb-4 uppercase tracking-widest">
            Which city?
          </p>
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={handleCitySubmit}
            placeholder="e.g. San Francisco, CA"
            className="w-full text-center font-sans text-xl md:text-2xl text-black placeholder:text-gray-300 bg-transparent border-b-2 border-black focus:outline-none py-2 transition-colors"
          />
          <p className="mt-8 font-sans text-sm text-gray-400">
            Press Enter ↵ to continue
          </p>
        </div>
      </StepContainer>

      {/* --- Step 5 --- */}
      <StepContainer stepIndex={5} currentStep={step}>
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
          className="px-10 py-4 bg-[#0A0A0A] text-white rounded-full font-sans font-medium text-lg hover:bg-gray-800 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-black whitespace-nowrap"
          style={{ padding: '1rem 2.5rem' }}
        >
          Go to Dashboard
        </button>
      </StepContainer>

    </div>
  )
}
