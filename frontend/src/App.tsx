import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import WaitlistPage from './components/WaitlistPage'
import OnboardingFlow from './components/OnboardingFlow'
import Dashboard from './components/Dashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import { UserProvider, useUser } from './context/UserContext'

// ── Auth Guard ────────────────────────────────────────────────────
// Protects routes that require a valid Supabase session.
// Shows nothing until auth state is known (avoids flash of wrong page).

function AuthGuard({ children, requireProfile = false, blockIfProfile = false }: { children: React.ReactNode, requireProfile?: boolean, blockIfProfile?: boolean }) {
  const { user, isLoadingAuth, hasProfile } = useUser()
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

  if (requireProfile && !hasProfile) {
    return <Navigate to="/onboarding" replace />
  }

  if (blockIfProfile && hasProfile) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// ── Admin Guard ───────────────────────────────────────────────────
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoadingAuth, candidateProfile } = useUser()

  if (isLoadingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user || !candidateProfile.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// ── App ───────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/waitlist" element={<WaitlistPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/onboarding" element={
        <AuthGuard blockIfProfile>
          <OnboardingFlow />
        </AuthGuard>
      } />
      <Route path="/dashboard" element={
        <AuthGuard requireProfile>
          <Dashboard />
        </AuthGuard>
      } />
      <Route path="/settings" element={
        <AuthGuard requireProfile>
          <OnboardingFlow />
        </AuthGuard>
      } />
      <Route path="/admin" element={
        <AdminGuard>
          <AdminDashboard />
        </AdminGuard>
      } />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
