import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import OnboardingFlow from './components/OnboardingFlow'
import Dashboard from './components/Dashboard'
import { UserProvider, useUser } from './context/UserContext'

// ── Auth Guard ────────────────────────────────────────────────────
// Protects routes that require a valid Supabase session.
// Shows nothing until auth state is known (avoids flash of wrong page).

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoadingAuth } = useUser()
  const location = useLocation()

  if (isLoadingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo-transparent.png" alt="Loading" className="h-12 w-auto animate-pulse" />
          <p className="font-sans text-sm text-gray-400">Loading your Ghost...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// ── App ───────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/onboarding" element={
        <AuthGuard>
          <OnboardingFlow />
        </AuthGuard>
      } />
      <Route path="/dashboard" element={
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </UserProvider>
  )
}
