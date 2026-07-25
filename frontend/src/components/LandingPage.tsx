import { ArrowRight, Pause, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

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
    primary: 'bg-[#0A0A0A] !text-white border-transparent hover:bg-[#374151]',
    ghost: 'bg-transparent !text-[#374151] border-transparent hover:!text-black',
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
  <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      {/* Logo */}
      <span className="font-heading font-bold text-xl text-[#0A0A0A] tracking-tight select-none">
        ghstCandidate
      </span>

      {/* Actions */}
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        <Button variant="ghost" size="sm" to="/auth">Log in</Button>
        <Button variant="primary" size="sm" to="/auth">Sign up</Button>
      </nav>
    </div>
  </header>
)

// ── 2. Hero ──────────────────────────────────────────────────────

const Hero = () => (
  <section className="pt-24 pb-16 px-6 text-center">
    <div className="max-w-4xl mx-auto">
      {/* Eyebrow tag */}
      <span className="inline-block font-sans text-xs font-medium tracking-widest uppercase text-gray-400 mb-8 border border-gray-200 px-3 py-1 rounded-full">
        Now in Early Access
      </span>

      {/* Headline */}
      <h1 className="font-heading font-bold text-5xl md:text-6xl lg:text-7xl text-[#0A0A0A] leading-[1.05] tracking-tight">
        Be the first to apply<br />
        to every job that fits.<br />
        <span className="text-gray-400">Hands off.</span>
      </h1>

      {/* Subheading */}
      <p className="font-sans text-center mx-auto text-balance text-lg md:text-xl text-gray-500 max-w-2xl mt-8 leading-relaxed">
        ghstCandidate monitors 50,000+ career pages and submits a tailored
        resume the moment a perfect role opens.
      </p>

      {/* CTA */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button variant="primary" size="lg">
          Get Started — Free for 25 applications
          <ArrowRight size={16} strokeWidth={2} />
        </Button>
        <span className="font-sans text-sm text-gray-400">No credit card required.</span>
      </div>

      {/* Dashboard mock-up placeholder */}
      <div className="mt-14 mx-auto max-w-5xl">
        <div className="relative rounded-2xl border border-gray-200 bg-gray-50 shadow-sm overflow-hidden h-[420px] md:h-[520px]">
          {/* Mock browser chrome bar */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-200 bg-white">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <span className="ml-4 font-sans text-xs text-gray-300 bg-gray-100 px-3 py-1 rounded-sm flex-1 max-w-xs">
              app.ghstcandidate.com/dashboard
            </span>
          </div>

          {/* Kanban columns */}
          <div className="flex gap-4 p-6 h-full overflow-hidden text-left">
            {[
              {
                title: 'Discovered',
                cards: [
                  { company: 'Stripe', role: 'Frontend Engineer', badge: '98% Match', badgeColor: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
                  { company: 'Netflix', role: 'UI Developer', badge: '85% Match', badgeColor: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
                ]
              },
              {
                title: 'Review',
                cards: [
                  { company: 'Vercel', role: 'Software Engineer', badge: 'Needs Input', badgeColor: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
                ]
              },
              {
                title: 'Applied',
                cards: [
                  { company: 'OpenAI', role: 'Frontend Developer', badge: 'Applied', badgeColor: 'bg-gray-50 text-gray-600 border-gray-200' },
                  { company: 'Linear', role: 'Product Engineer', badge: 'Applied', badgeColor: 'bg-gray-50 text-gray-600 border-gray-200' },
                ]
              }
            ].map((col) => (
              <div key={col.title} className="flex-1 flex flex-col gap-3 min-w-0">
                <div className="font-sans text-xs font-medium text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-200">
                  {col.title}
                </div>
                {col.cards.map((card, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-1 shadow-sm"
                  >
                    <div className="font-heading font-bold text-sm text-[#0A0A0A]">
                      {card.company}
                    </div>
                    <div className="font-sans text-xs text-gray-500 mb-2">
                      {card.role}
                    </div>
                    <div>
                      <span className={`inline-flex font-sans text-[10px] font-medium px-2 py-0.5 rounded-sm border ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="font-sans text-xs text-gray-400 mt-3 text-center tracking-wide">
          Dashboard — live kanban view of every active application
        </p>
      </div>
    </div>
  </section>
)

// ── 3. Social Proof Band ─────────────────────────────────────────

const LOGOS = ['Stripe', 'Vercel', 'Meta', 'Netflix', 'Figma', 'Linear']

const SocialProofBand = () => (
  <section className="border-y border-gray-100 py-10 px-6">
    <div className="max-w-5xl mx-auto text-center">
      <p className="font-sans text-xs uppercase tracking-widest text-gray-400 mb-7">
        Where our users have been hired
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {LOGOS.map((name) => (
          <span key={name} className="font-sans font-bold text-base text-gray-300 select-none">
            {name}
          </span>
        ))}
      </div>
    </div>
  </section>
)

// ── 4. How It Works (Bento Grid) ─────────────────────────────────

interface WorkCardProps {
  step: string
  title: string
  body: string
}

const WorkCard = ({ step, title, body }: WorkCardProps) => (
  <div className="border border-gray-200 bg-white rounded-xl p-8 flex flex-col gap-4 transition-shadow duration-200 hover:shadow-md">
    <span className="font-sans text-xs font-medium text-gray-400 uppercase tracking-widest">
      {step}
    </span>
    <h3 className="font-heading font-bold text-lg text-[#0A0A0A] leading-snug">{title}</h3>
    <p className="font-sans text-sm text-gray-500 leading-relaxed">{body}</p>
  </div>
)

const HowItWorks = () => (
  <section className="py-24 px-6">
    <div className="max-w-6xl mx-auto">
      {/* Section header */}
      <div className="mb-14">
        <p className="font-sans text-xs font-medium uppercase tracking-widest text-gray-400 mb-3">
          The process
        </p>
        <h2 className="font-heading font-bold text-3xl md:text-4xl text-[#0A0A0A] tracking-tight">
          The Ghost Workflow
        </h2>
      </div>

      {/* 3-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WorkCard
          step="Step 01"
          title="Set the Target"
          body="Upload your base CV once. Tell us your target roles, industries, and dealbreakers. We handle the rest from here."
        />
        <WorkCard
          step="Step 02"
          title="AI Matchmaking"
          body="Our model scans thousands of live job postings each hour, scores them against your profile, and tailors your resume for each one."
        />
        <WorkCard
          step="Step 03"
          title="The Ghost Worker"
          body="Approve your match queue. We open each application form, fill every field, and submit — silently, in the background, around the clock."
        />
      </div>
    </div>
  </section>
)

// ── 5. Human-in-the-Loop ─────────────────────────────────────────

const HumanInTheLoop = () => (
  <section className="py-24 px-6 bg-gray-50 border-y border-gray-100">
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
      {/* Left — copy */}
      <div>
        <p className="font-sans text-xs font-medium uppercase tracking-widest text-gray-400 mb-4">
          Human in the loop
        </p>
        <h2 className="font-heading font-bold text-3xl md:text-4xl text-[#0A0A0A] tracking-tight leading-snug mb-6">
          You are always in control.
        </h2>
        <p className="font-sans text-base text-gray-500 leading-relaxed mb-6">
          AI is not perfect. If an application asks a question we cannot answer
          from your profile, the Ghost pauses, pings you, and waits for your
          answer before it proceeds.
        </p>
        <ul className="flex flex-col gap-3">
          {[
            'Instant notification via email or browser push',
            'One-tap response — no login required',
            'Ghost resumes the application exactly where it paused',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 font-sans text-sm text-gray-500">
              <CheckCircle2 size={15} strokeWidth={2} className="text-[#0A0A0A] mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Right — mock prompt UI */}
      <div className="flex items-center justify-center">
        <div className="w-full max-w-sm border border-gray-200 bg-white rounded-xl overflow-hidden shadow-sm">
          {/* Terminal chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <Pause size={12} strokeWidth={2} className="text-[#D97706]" />
            <span className="font-sans text-xs font-medium text-gray-500">
              Application paused — input required
            </span>
          </div>

          {/* Prompt body */}
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="font-sans text-[10px] font-bold text-gray-400">G</span>
              </div>
              <p className="font-sans text-sm text-gray-700 leading-relaxed">
                The employer's form asks: <strong className="text-[#0A0A0A]">"Are you willing to relocate to Austin, TX?"</strong>
                <br />
                This was not specified in your preferences.
              </p>
            </div>

            {/* Response buttons */}
            <div className="flex gap-2 pl-9">
              <button className="flex-1 font-sans text-sm font-medium border border-gray-200 text-[#0A0A0A] py-2 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
                Yes
              </button>
              <button className="flex-1 font-sans text-sm font-medium border border-gray-200 text-[#0A0A0A] py-2 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
                No
              </button>
              <button className="flex-1 font-sans text-sm font-medium border border-gray-200 text-gray-400 py-2 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
                Skip job
              </button>
            </div>

            <p className="pl-9 font-sans text-[11px] text-gray-400">
              Ghost will resume the application immediately after your response.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
)

// ── 6. Final CTA ─────────────────────────────────────────────────

const FinalCTA = () => (
  <section className="py-32 px-6 text-center">
    <div className="max-w-3xl mx-auto">
      <h2 className="font-heading font-bold text-4xl md:text-5xl text-[#0A0A0A] tracking-tight leading-[1.1]">
        Stop tracking jobs.
        <br />
        Start taking interviews.
      </h2>
      <p className="font-sans text-center mx-auto text-balance text-base text-gray-500 mt-6 max-w-xl leading-relaxed">
        Join thousands of candidates who let their Ghost handle the grind while
        they focus on what matters — the conversations.
      </p>
      <div className="mt-10">
        <Button variant="primary" size="lg">
          Start Your Free Trial
          <ArrowRight size={16} strokeWidth={2} />
        </Button>
      </div>
    </div>
  </section>
)

// ── Footer ───────────────────────────────────────────────────────

const Footer = () => (
  <footer className="border-t border-gray-100 py-10 px-6">
    <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <span className="font-heading font-bold text-sm text-[#0A0A0A]">ghstCandidate</span>

      <nav className="flex items-center gap-6" aria-label="Footer navigation">
        {['Privacy', 'Terms', 'Contact'].map((link) => (
          <a
            key={link}
            href="#"
            className="font-sans text-xs text-gray-400 hover:text-[#0A0A0A] transition-colors"
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
