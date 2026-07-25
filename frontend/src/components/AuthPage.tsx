import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true)
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/onboarding')
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white text-[#0A0A0A]">
      {/* Back to Home Link */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-50 flex items-center gap-2 text-sm font-sans font-medium text-gray-500 hover:text-black transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      {/* --- Form Container --- */}
      <div
        className={`absolute top-0 left-0 w-1/2 h-full flex flex-col items-center justify-center p-12 transition-transform duration-700 ease-in-out bg-white ${
          isSignUp ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="w-full max-w-sm flex flex-col items-center">
          
          {/* Toggle Pill */}
          <div className="flex bg-gray-50 rounded-full p-1 border border-gray-200 mb-12 w-64 relative">
            {/* Sliding Background */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-transform duration-500 ease-in-out border border-gray-200 ${
                isSignUp ? 'left-1 translate-x-0' : 'left-1 translate-x-full'
              }`}
            ></div>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 text-center py-2 text-sm font-sans font-medium relative z-10 transition-colors ${
                isSignUp ? 'text-black' : 'text-gray-500 hover:text-black'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setIsSignUp(false)}
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
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-[2px] bg-gray-50 px-3 py-2.5 font-sans text-sm placeholder:text-gray-500 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-shadow"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-xs font-medium text-gray-700">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-[2px] bg-gray-50 px-3 py-2.5 font-sans text-sm placeholder:text-gray-500 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-shadow"
              />
            </div>
            <button
              type="submit"
              className="mt-2 w-full bg-[#0A0A0A] text-white font-sans font-medium py-3 rounded-[2px] hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              {isSignUp ? 'Sign Up' : 'Log In'}
            </button>
          </form>

          <div className="w-full flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="font-sans text-xs text-gray-400">OR</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button className="w-full border border-gray-300 rounded-[2px] bg-white px-4 py-2.5 font-sans text-sm font-medium text-[#0A0A0A] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              Continue with Google
            </button>
            <button className="w-full border border-gray-300 rounded-[2px] bg-white px-4 py-2.5 font-sans text-sm font-medium text-[#0A0A0A] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Continue with LinkedIn
            </button>
          </div>
        </div>
      </div>

      {/* --- Image/Graphic Container --- */}
      <div
        className={`absolute top-0 left-0 w-1/2 h-full bg-[#0A0A0A] transition-all duration-700 ease-in-out flex flex-col items-center justify-center p-12 overflow-hidden ${
          isSignUp
            ? 'translate-x-full rounded-l-3xl'
            : 'translate-x-0 rounded-r-3xl'
        }`}
      >
        <div className="relative z-10 max-w-md text-center">
          <h2 className="font-heading font-bold text-4xl text-white mb-6 leading-tight">
            The silent engine<br />for your career.
          </h2>
          <p className="font-sans text-lg text-gray-400">
            Let the Ghost worker handle the grind. You focus on the conversations that matter.
          </p>
        </div>
        
        {/* Abstract structural visual behind text */}
        <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
          <div className="w-[800px] h-[800px] border-[40px] border-white rounded-full"></div>
          <div className="absolute w-[600px] h-[600px] border-[2px] border-white rounded-full"></div>
          <div className="absolute w-[400px] h-[400px] border-[1px] border-white rounded-full"></div>
        </div>
      </div>

    </div>
  )
}
