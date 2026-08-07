import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, Clock, CheckCircle2, TrendingUp, Send, Zap } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import authVideo from '../assets/auth-bg.mp4'

const PLACEHOLDERS = [
  { email: 'alex@react.dev', password: 'frontend_wizard_2026' },
  { email: 'jane@startup.io', password: 'deploy_to_prod_!' },
  { email: 'sam@nextjs.com', password: 'server_components_123' },
  { email: 'founder@unicorn.io', password: 'series_a_funding' }
]

const TESTIMONIALS = [
  {
    id: 1,
    image: "/testimonials/testimonial-1.jpg",
    quote: "ghstCandidate landed me a Senior DevOps role in two weeks. I didn't manually fill out a single Workday form.",
    author: "Malik K.",
    role: "DevOps Engineer",
    icon: Clock,
    badgeText: "Saved 45 Hours"
  },
  {
    id: 2,
    image: "/testimonials/testimonial-2.jpg",
    quote: "The Ghost worker applied to 300 jobs while I was sleeping. I woke up to 4 interview requests from top startups.",
    author: "Elena R.",
    role: "Product Manager",
    icon: CheckCircle2,
    badgeText: "Hired in 7 Days"
  },
  {
    id: 3,
    image: "/testimonials/testimonial-3.jpg",
    quote: "I was skeptical, but the AI tailoring is genuinely better than my own manual resume tweaks. The match rate is insane.",
    author: "David C.",
    role: "Data Scientist",
    icon: TrendingUp,
    badgeText: "3x Interview Rate"
  },
  {
    id: 4,
    image: "/testimonials/testimonial-4.jpg",
    quote: "It's like having a dedicated recruiting agency working for you 24/7. Absolutely game-changing for my career shift.",
    author: "Aisha M.",
    role: "UX Designer",
    icon: Send,
    badgeText: "500+ Applications"
  },
  {
    id: 5,
    image: "/testimonials/testimonial-5.jpg",
    quote: "I let the Ghost handle the grind while I focused on interview prep. I've never felt more relaxed job hunting.",
    author: "Kenji T.",
    role: "Frontend Developer",
    icon: Zap,
    badgeText: "Autonomous Search"
  }
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
  const [currentTestiIdx, setCurrentTestiIdx] = useState(0)
  
  const navigate = useNavigate()

  useEffect(() => {
    const rand = Math.floor(Math.random() * PLACEHOLDERS.length)
    setPlaceholders(PLACEHOLDERS[rand])
    
    const timer = setInterval(() => {
      setCurrentTestiIdx((prev) => (prev + 1) % TESTIMONIALS.length)
    }, 5000)
    return () => clearInterval(timer)
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
                className="w-full bg-transparent border-b border-black py-2.5 font-sans text-base md:text-sm placeholder-gray-400 focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors"
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
                className="w-full bg-transparent border-b border-black py-2.5 font-sans text-base md:text-sm placeholder-gray-400 focus:outline-none focus:border-b-2 focus:border-[#ff6900] transition-colors"
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

        </div>
      </div>

      {/* --- Editorial Testimonial Container --- */}
      <div
        className={`hidden lg:flex absolute top-0 left-0 w-1/2 h-full transition-all duration-700 ease-in-out p-3 lg:p-4 ${
          isSignUp
            ? 'translate-x-full rounded-l-3xl'
            : 'translate-x-0 rounded-r-3xl'
        }`}
      >
        <div className="w-full h-full relative rounded-[32px] overflow-hidden shadow-2xl bg-[#0A0A0A]">
          {TESTIMONIALS.map((testi, idx) => (
            <div 
              key={testi.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentTestiIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              {/* Background Image - z-0 */}
              <img
                src={testi.image}
                alt="User testimonial"
                className="absolute inset-0 w-full h-full object-cover z-0"
              />
              
              {/* Gradient Overlay - z-10 */}
              <div className="absolute bottom-0 left-0 w-full h-[65%] bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10"></div>
              
              {/* Bottom Content Area - Force z-20 and explicit hex colors */}
              <div className="absolute bottom-12 left-8 right-8 flex flex-col items-start gap-4 z-20">
                
                {/* Achievement Pill */}
                <div className="bg-white/20 backdrop-blur-md text-[#FFFFFF] text-xs font-sans font-medium px-3.5 py-1.5 rounded-full shadow-sm border border-white/20 flex items-center gap-2">
                  <testi.icon className="w-3.5 h-3.5 text-[#ff6900]" />
                  <span>{testi.badgeText}</span>
                </div>
                
                {/* Testimonial Quote */}
                <p className="text-2xl lg:text-3xl font-sans font-semibold leading-snug text-balance" style={{ color: '#FFFFFF', textShadow: '0px 4px 12px rgba(0,0,0,0.8)' }}>
                  "{testi.quote}"
                </p>
                
                {/* Attribution */}
                <p className="text-sm font-sans font-medium mt-3" style={{ color: '#FFFFFF', opacity: 0.9 }}>
                  {testi.author} - {testi.role}
                </p>
              </div>
            </div>
          ))}

          {/* Top Quote Icon - Fixed over carousel */}
          <div className="absolute top-8 left-8 size-12 bg-white rounded-xl flex items-center justify-center shadow-lg z-20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 11H6.5C6.5 8.5 8 7 10 7V5C7 5 4.5 7.5 4.5 11V18H10V11ZM20 11H16.5C16.5 8.5 18 7 20 7V5C17 5 14.5 7.5 14.5 11V18H20V11Z" fill="currentColor"/>
            </svg>
          </div>

          {/* Story Progress Bar - Fixed over carousel */}
          <div className="absolute bottom-4 left-8 right-8 flex gap-1.5 z-20">
            {TESTIMONIALS.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                  idx === currentTestiIdx 
                    ? 'bg-[#ff6900] shadow-[0_0_8px_rgba(255,105,0,0.8)]' 
                    : 'bg-white/30'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
