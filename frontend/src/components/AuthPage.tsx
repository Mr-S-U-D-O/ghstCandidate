import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import authVideo from '../assets/auth-bg.mp4'

const PLACEHOLDERS = [
  { email: 'alex@react.dev', password: 'frontend_wizard_2026' },
  { email: 'jane@startup.io', password: 'deploy_to_prod_!' },
  { email: 'sam@nextjs.com', password: 'server_components_123' },
  { email: 'founder@unicorn.io', password: 'series_a_funding' }
]

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')
  
  const [isSignUp, setIsSignUp] = useState(mode === 'login' ? false : true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [oAuthLoading, setOAuthLoading] = useState<'google' | 'linkedin_oidc' | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [placeholders, setPlaceholders] = useState(PLACEHOLDERS[0])
  
  const navigate = useNavigate()

  useEffect(() => {
    const rand = Math.floor(Math.random() * PLACEHOLDERS.length)
    setPlaceholders(PLACEHOLDERS[rand])
  }, [])

  const getFriendlyErrorMessage = (msg: string) => {
    if (msg.includes('already registered')) return 'This email is already hunting jobs. Try logging in instead.'
    if (msg.includes('Invalid login credentials')) return 'Incorrect email or password. Please try again.'
    if (msg.includes('least 6 characters')) return 'Your password needs to be at least 6 characters.'
    return msg
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // New user → onboarding
        navigate('/onboarding')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // Returning user → dashboard
        navigate('/dashboard')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.'
      setError(getFriendlyErrorMessage(message))
      console.error('[AuthPage] Auth error:', message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'linkedin_oidc') => {
    setError(null)
    setOAuthLoading(provider)
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider })
      if (error) throw error
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.'
      setError(getFriendlyErrorMessage(message))
      setOAuthLoading(null)
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white text-[#0A0A0A]">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>

      {/* --- Form Container --- */}
      <div
        className={`absolute top-0 left-0 w-full md:w-1/2 h-full flex flex-col items-center justify-center p-6 md:p-12 transition-transform duration-700 ease-in-out bg-white ${
          isSignUp ? 'translate-x-0' : 'translate-x-0 md:translate-x-full'
        }`}
      >
        {/* Back to Home Link - Roaming */}
        <Link
          to="/"
          className="absolute top-6 left-6 z-50 flex items-center gap-2 text-sm font-sans font-medium text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <div className="w-full max-w-sm flex flex-col items-center">
          
          <div className="flex items-center gap-1 mb-8">
            <img src="/logo-transparent.png" alt="ghstCandidate Logo" className="h-8 w-auto -mr-1.5" />
            <span className="font-heading font-bold text-xl text-[#0A0A0A] tracking-tight">ghstCandidate</span>
          </div>
          
          {/* Toggle Pill */}
          <div className="flex bg-gray-50 rounded-full p-1 border border-gray-200 mb-12 w-64 relative">
            {/* Sliding Background */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-transform duration-500 ease-in-out border border-gray-200 ${
                isSignUp ? 'left-1 translate-x-0' : 'left-1 translate-x-full'
              }`}
            ></div>
            <button
              onClick={() => { setIsSignUp(true); setError(null) }}
              className={`flex-1 text-center py-2 text-sm font-sans font-medium relative z-10 transition-colors ${
                isSignUp ? 'text-black' : 'text-gray-500 hover:text-black'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setIsSignUp(false); setError(null) }}
              className={`flex-1 text-center py-2 text-sm font-sans font-medium relative z-10 transition-colors ${
                !isSignUp ? 'text-black' : 'text-gray-500 hover:text-black'
              }`}
            >
              Log In
            </button>
          </div>

          <h1 className="font-heading font-bold text-3xl mb-8">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>

          <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-xs font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={placeholders.email}
                required
                className="w-full border border-gray-300 rounded-[2px] bg-gray-50 px-3 py-2.5 font-sans text-base md:text-sm placeholder:text-gray-500 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-shadow"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-xs font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={placeholders.password}
                required
                minLength={6}
                className="w-full border border-gray-300 rounded-[2px] bg-gray-50 px-3 py-2.5 font-sans text-base md:text-sm placeholder:text-gray-500 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-shadow"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="animate-shake font-sans text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-1 flex items-start gap-2 shadow-sm">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full bg-[#0A0A0A] text-white font-sans font-medium py-3 rounded-[2px] hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading
                ? <><Loader2 size={15} className="animate-spin" /> Processing...</>
                : isSignUp ? 'Sign Up' : 'Log In'
              }
            </button>
          </form>

          <div className="w-full flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="font-sans text-xs text-gray-400">OR</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oAuthLoading}
              className="w-full border border-gray-300 rounded-[2px] bg-white px-4 py-2.5 font-sans text-sm font-medium text-[#0A0A0A] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {oAuthLoading === 'google' ? <Loader2 size={15} className="animate-spin" /> : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
              )}
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('linkedin_oidc')}
              disabled={!!oAuthLoading}
              className="w-full border border-gray-300 rounded-[2px] bg-white px-4 py-2.5 font-sans text-sm font-medium text-[#0A0A0A] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {oAuthLoading === 'linkedin_oidc' ? <Loader2 size={15} className="animate-spin" /> : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              )}
              Continue with LinkedIn
            </button>
          </div>
        </div>
      </div>

      {/* --- Image/Graphic Container with Cinematic Video Background --- */}
      <div
        className={`hidden md:flex absolute top-0 left-0 w-1/2 h-full bg-[#0A0A0A] transition-all duration-700 ease-in-out flex-col items-center justify-center p-12 overflow-hidden ${
          isSignUp
            ? 'translate-x-full rounded-l-3xl'
            : 'translate-x-0 rounded-r-3xl'
        }`}
      >
        <video
          src={authVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20 pointer-events-none"></div>
      </div>

    </div>
  )
}
