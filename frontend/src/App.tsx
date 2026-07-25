import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import AuthPage from './components/AuthPage'
import OnboardingFlow from './components/OnboardingFlow'
import Dashboard from './components/Dashboard'
import { UserProvider } from './context/UserContext'

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/onboarding" element={<OnboardingFlow />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  )
}
