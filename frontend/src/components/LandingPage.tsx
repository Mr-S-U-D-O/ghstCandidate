import { ArrowRight, Pause, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'

/* ─────────────────────────────────────────────────────────────────
   ghstCandidate — Landing Page
   Design contract: black/white/off-white only · Comfortaa headings
   · Lato body · zero gradients · whitespace-first
───────────────────────────────────────────────────────────────── */

// ── Reusable primitives ──────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  to?: string
}

const Button = ({ variant = 'primary', size = 'md', to, className = '', children, ...props }: ButtonProps) => {
  const base =
    'inline-flex items-center gap-2 font-sans font-medium tracking-tight transition-colors duration-150 cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded-full'

  const variants = {
    primary: 'bg-[#0A0A0A] !text-white border-transparent hover:bg-orange-500',
    ghost: 'bg-transparent !text-[#374151] border-transparent hover:!text-orange-500',
  }

  const sizes = {
    sm: 'px-4 py-1.5 text-sm',
    md: 'px-5 py-2 text-sm',
    lg: 'px-7 py-3.5 text-base',
  }

  if (to) {
    return (
      <Link to={to} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
        {children}
      </Link>
    )
  }

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}

// ── 1. Navigation ────────────────────────────────────────────────

const Nav = () => (
  <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all">
    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-1">
        <img src="/logo-transparent.png" alt="ghstCandidate Logo" className="h-8 w-auto -mr-1.5" />
        <span className="font-heading font-bold text-xl text-[#0A0A0A] tracking-tight select-none">
          <span className="text-orange-500">ghst</span>Candidate
        </span>
      </div>

      {/* Actions */}
      <nav className="flex items-center gap-2" aria-label="Main navigation">
        <Button variant="ghost" size="sm" to="/auth?mode=login">Log in</Button>
        <Button variant="primary" size="sm" to="/auth?mode=signup">Sign up</Button>
      </nav>
    </div>
  </header>
)

// ── 2. Hero ──────────────────────────────────────────────────────

const Hero = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
  }

  return (
    <section className="pt-32 pb-16 px-6 overflow-hidden min-h-[100dvh] flex items-center">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center w-full">
        
        {/* Left Side: Typography */}
        <motion.div 
          className="flex flex-col gap-8 text-left"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item}>
             <span className="inline-block font-sans text-xs font-medium tracking-widest uppercase text-orange-500 border border-orange-500 bg-transparent px-3 py-1 rounded-full">
               Now in Early Access
             </span>
          </motion.div>

          <motion.h1 variants={item} className="font-heading font-bold text-5xl md:text-6xl lg:text-7xl text-[#0A0A0A] leading-[1.05] tracking-tight max-w-[15ch]">
            Be the first to apply to every job that fits.
            <br />
            <span className="text-gray-400">Hands off.</span>
          </motion.h1>

          <motion.p variants={item} className="font-sans text-lg md:text-xl text-gray-500 max-w-xl leading-relaxed">
            ghstCandidate monitors 50,000+ career pages and submits a tailored
            resume the moment a perfect role opens.
          </motion.p>

          <motion.div variants={item} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
            <Button variant="primary" size="lg" to="/waitlist">
              Join Waitlist
              <ArrowRight size={16} strokeWidth={2} />
            </Button>
            <div className="font-sans text-sm text-gray-400">
              Free for first 10 applications &bull; No credit card required
            </div>
          </motion.div>
        </motion.div>

        {/* Right Side: Dashboard Mockup feed */}
        <motion.div 
           initial={{ opacity: 0, x: 40 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
           className="relative mx-auto w-full max-w-2xl lg:max-w-none"
        >
           <div className="relative rounded-2xl border border-gray-200 bg-gray-50 shadow-sm overflow-hidden h-[520px] flex flex-col">
             {/* Mock browser chrome bar */}
             <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
               <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
               <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
               <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
               <span className="ml-4 font-sans text-xs text-gray-300 bg-gray-100 px-3 py-1 rounded-sm flex-1 max-w-xs truncate">
                 app.ghstcandidate.com/dashboard
               </span>
             </div>

             {/* Live Activity Feed / Kanban */}
             <div className="flex-1 p-6 overflow-hidden flex gap-4">
                {/* Column 1 */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="font-sans text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">
                    Discovered
                  </div>
                  {/* Card 1 */}
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                  >
                    <div className="font-heading font-bold text-sm text-[#0A0A0A]">Vercel</div>
                    <div className="font-sans text-xs text-gray-500 mb-2">Frontend Engineer</div>
                    <span className="inline-flex font-sans text-[10px] font-medium px-2 py-0.5 rounded-sm border bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]">98% Match</span>
                  </motion.div>

                  {/* Card 2 */}
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.8, duration: 0.5 }}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                  >
                    <div className="font-heading font-bold text-sm text-[#0A0A0A]">Stripe</div>
                    <div className="font-sans text-xs text-gray-500 mb-2">UI Developer</div>
                    <span className="inline-flex font-sans text-[10px] font-medium px-2 py-0.5 rounded-sm border bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]">85% Match</span>
                  </motion.div>
                </div>

                {/* Column 2 */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="font-sans text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200 flex items-center gap-2">
                    Applying <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  </div>
                  
                  {/* Active applying card */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2, duration: 0.4 }}
                    className="bg-white border border-orange-500 rounded-lg p-4 shadow-md ring-4 ring-orange-500/10"
                  >
                    <div className="font-heading font-bold text-sm text-[#0A0A0A]">Linear</div>
                    <div className="font-sans text-xs text-gray-500 mb-2">Product Engineer</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          className="bg-orange-500 h-1.5 rounded-full" 
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ delay: 1.4, duration: 2, ease: "linear", repeat: Infinity, repeatType: "loop" }}
                        />
                      </div>
                    </div>
                  </motion.div>
                </div>
             </div>
           </div>
        </motion.div>

      </div>
    </section>
  )
}

// ── 3. Social Proof Band ─────────────────────────────────────────

const LOGOS = [
  { name: 'Apple', src: '/brand-logos/apple-11.svg' },
  { name: 'FedEx', src: '/brand-logos/fedex-express-6.svg' },
  { name: 'Figma', src: '/brand-logos/figma-svgrepo-com.svg' },
  { name: 'Google', src: '/brand-logos/google-logo-search-new-svgrepo-com.svg' },
  { name: 'McDonalds', src: '/brand-logos/mcdonalds-6.svg' },
  { name: 'Meta', src: '/brand-logos/meta-3.svg' },
  { name: 'Microsoft', src: '/brand-logos/microsoft-6.svg' },
  { name: 'Netflix', src: '/brand-logos/netflix-2-logo-svgrepo-com.svg' },
  { name: 'OpenAI', src: '/brand-logos/openai-logo-1.svg' },
  { name: 'Shell', src: '/brand-logos/shell-4.svg' },
  { name: 'Stripe', src: '/brand-logos/stripe-svgrepo-com.svg' }
]

const SocialProofBand = () => (
  <section className="border-y border-gray-100 py-12 overflow-hidden relative bg-white">
    <style>{`
      @keyframes marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .animate-marquee {
        animation: marquee 30s linear infinite;
      }
      .animate-marquee:hover {
        animation-play-state: paused;
      }
    `}</style>
    <div className="max-w-5xl mx-auto text-center mb-10 px-6">
      <p className="font-sans text-xs uppercase tracking-widest text-gray-400">
        Where our users have been hired
      </p>
    </div>
    
    <div className="w-full inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
      <div className="flex animate-marquee items-center justify-center gap-16 md:gap-24 w-max px-8">
        {[...LOGOS, ...LOGOS].map((logo, i) => (
          <div key={i} className="flex flex-col items-center justify-center w-32 shrink-0">
            <img 
              src={logo.src} 
              alt={logo.name}
              className="h-8 w-auto object-contain grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            />
          </div>
        ))}
      </div>
    </div>
  </section>
)

// ── 4. How It Works (Bento Grid) ─────────────────────────────────

const HowItWorks = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
  }

  return (
    <section className="py-32 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-16">
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-[#0A0A0A] tracking-tight">
            The Ghost Workflow
          </h2>
        </div>

        {/* Asymmetric Bento Grid */}
        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[minmax(280px,auto)]"
        >
          {/* Cell 1: Set the Target (Wide) */}
          <motion.div variants={item} className="md:col-span-8 border border-gray-200 bg-white rounded-2xl p-8 flex flex-col justify-between overflow-hidden relative group">
            <div className="relative z-10 max-w-md">
              <h3 className="font-heading font-bold text-2xl text-[#0A0A0A] mb-3">Set the Target</h3>
              <p className="font-sans text-sm md:text-base text-gray-500 leading-relaxed">
                Upload your base CV once. Tell us your target roles, industries, and dealbreakers. We handle the rest from here.
              </p>
            </div>
            {/* Abstract visual */}
            <div className="absolute right-0 bottom-0 p-8 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
               <div className="flex flex-col gap-2 transform rotate-3">
                 <span className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-xs font-medium self-end shadow-sm">Remote</span>
                 <span className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-xs font-medium self-end shadow-sm -translate-x-4">$150k+</span>
                 <span className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-xs font-medium self-end shadow-sm">React Developer</span>
               </div>
            </div>
          </motion.div>

          {/* Cell 2: AI Matchmaking (Square) */}
          <motion.div variants={item} className="md:col-span-4 border border-gray-200 bg-zinc-50 rounded-2xl p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-heading font-bold text-xl text-[#0A0A0A] mb-3">AI Matchmaking</h3>
              <p className="font-sans text-sm text-gray-500 leading-relaxed">
                Our model scans live postings, scores them, and tailors your resume.
              </p>
            </div>
            {/* Scanning visual */}
            <div className="mt-8 flex items-center gap-3">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500"></span>
              </span>
              <span className="font-sans text-xs font-medium text-gray-500 uppercase tracking-widest">Scanning Jobs</span>
            </div>
          </motion.div>

          {/* Cell 3: The Ghost Worker (Wide/Full) */}
          <motion.div variants={item} className="md:col-span-12 border border-gray-200 bg-[#0A0A0A] text-white rounded-2xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 overflow-hidden relative">
            <div className="relative z-10 max-w-xl">
              <h3 className="font-heading font-bold text-2xl mb-3">The Ghost Worker</h3>
              <p className="font-sans text-sm md:text-base text-gray-400 leading-relaxed">
                Approve your match queue. We open each application form, fill every field, and submit — silently, in the background, around the clock.
              </p>
            </div>
            {/* Active Agent Visual */}
            <div className="relative z-10 w-full md:w-auto min-w-[280px]">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="font-sans text-xs font-medium tracking-wide">Agent Active</span>
                  </div>
                  <span className="font-sans text-xs text-gray-400">03:42:11</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-sans text-sm text-gray-300">Ashby ATS</span>
                  <span className="font-sans text-sm text-green-400">Submitting...</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ── 5. Human-in-the-Loop ─────────────────────────────────────────

const HumanInTheLoop = () => {
  return (
    <section className="py-32 px-6 bg-[#0A0A0A] text-white border-y border-gray-900 overflow-hidden relative">
      <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 max-w-3xl"
        >
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-orange-500 mb-4">
            Human in the loop
          </p>
          <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight leading-snug mb-6">
            You are always in control.
          </h2>
          <p className="font-sans text-lg text-gray-400 leading-relaxed text-balance">
            AI is not perfect. If an application asks a question we cannot answer
            from your profile, the Ghost pauses, pings you, and waits for your
            answer before it proceeds.
          </p>
        </motion.div>

        {/* Interactive UI Mockup */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          className="w-full max-w-2xl"
        >
          <div className="w-full border border-white/10 bg-[#111] rounded-2xl overflow-hidden shadow-2xl relative">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-5 py-4 bg-[#1A1A1A] border-b border-white/5">
              <Pause size={14} strokeWidth={2} className="text-orange-500" />
              <span className="font-sans text-sm font-medium text-gray-300">
                Application paused — input required
              </span>
            </div>

            {/* Prompt body */}
            <div className="p-8 flex flex-col gap-6 text-left">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                  <span className="font-sans text-xs font-bold text-gray-400">G</span>
                </div>
                <div className="space-y-2">
                  <p className="font-sans text-base text-gray-300 leading-relaxed">
                    The employer's form asks: <strong className="text-white">"Are you willing to relocate to Austin, TX?"</strong>
                  </p>
                  <p className="font-sans text-sm text-gray-500">
                    This was not specified in your preferences.
                  </p>
                </div>
              </div>

              {/* Response buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pl-12 mt-2">
                <button className="flex-1 font-sans text-sm font-medium border border-white/20 bg-white text-black py-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-center relative group overflow-hidden">
                  <span className="relative z-10">Yes, I am</span>
                </button>
                <button className="flex-1 font-sans text-sm font-medium border border-white/20 text-white py-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-center">
                  No, I'm not
                </button>
                <button className="flex-1 font-sans text-sm font-medium border border-transparent text-gray-500 py-3 rounded-lg hover:text-gray-300 transition-colors cursor-pointer text-center">
                  Skip job
                </button>
              </div>

              <div className="pl-12 flex items-center gap-2 mt-4">
                 <CheckCircle2 size={14} className="text-green-500" />
                 <p className="font-sans text-xs text-gray-500">
                   Ghost will resume the application immediately after your response.
                 </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ── 6. Final CTA ─────────────────────────────────────────────────

const FinalCTA = () => (
  <section className="py-40 px-6 text-center bg-white">
    <div className="max-w-4xl mx-auto flex flex-col items-center">
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-heading font-bold text-5xl md:text-7xl text-[#0A0A0A] tracking-tighter leading-[1.05]"
      >
        Stop tracking jobs.
        <br />
        Start taking interviews.
      </motion.h2>
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="mt-8 flex justify-center w-full"
      >
        <p className="font-sans text-center text-balance text-lg md:text-xl text-gray-500 max-w-2xl leading-relaxed">
          Join thousands of candidates who let their Ghost handle the grind
          while they focus on what matters — the conversations.
        </p>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className="mt-12 flex justify-center"
      >
        <Button variant="primary" size="lg" to="/waitlist" className="px-8 py-4 text-lg">
          Join Waitlist
          <ArrowRight size={18} strokeWidth={2} />
        </Button>
      </motion.div>
    </div>
  </section>
);

// ── Footer ───────────────────────────────────────────────────────

const Footer = () => (
  <footer className="border-t border-gray-100 py-10 px-6">
    <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <span className="font-heading font-bold text-sm text-[#0A0A0A]">
        <span className="text-orange-500">ghst</span>Candidate
      </span>

      <nav className="flex items-center gap-6" aria-label="Footer navigation">
        {['Privacy', 'Terms', 'Contact'].map((link) => (
          <a
            key={link}
            href="#"
            className="font-sans text-xs text-gray-400 hover:text-orange-500 transition-colors"
          >
            {link}
          </a>
        ))}
      </nav>

      <p className="font-sans text-xs text-gray-400">
        &copy; {new Date().getFullYear()} ghstCandidate. All rights reserved.
      </p>
    </div>
  </footer>
)

// ── Page assembly ────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      <Nav />
      <main>
        <Hero />
        <SocialProofBand />
        <HowItWorks />
        <HumanInTheLoop />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
