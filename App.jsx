import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Shell } from './components.jsx'
import { Admin } from './admin.jsx'
import { Account, ForgotPassword, Login, ResetPassword, Signup, VerifyEmail } from './pages-account.jsx'
import { About, Contact, Help, Home, HowItWorks, NotFound, Pricing, Privacy, Product, SecurityInfo, Situations, Terms } from './pages-public.jsx'
import { Dashboard, Summary, Wizard } from './pages-workspace.jsx'
import { useApp } from './store.jsx'

export function App() {
  const { configIssues } = useApp()
  if (configIssues.length) {
    return <main id="main"><h1>Configuration blocked</h1><p>{configIssues.join(' ')}</p></main>
  }
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/product" element={<Product />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/situations" element={<Situations />} />
      <Route path="/help" element={<Help />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/security" element={<SecurityInfo />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/account" element={<Protected><Account /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="/returns/:id/summary" element={<Protected><Summary /></Protected>} />
      <Route path="/returns/:id/:step" element={<Protected><WizardRoute /></Protected>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function Protected({ children }) {
  const { user, ready } = useApp()
  const location = useLocation()
  if (!ready) return <main id="main"><p>Checking session…</p></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />
  return <Workspace>{children}</Workspace>
}

function Workspace({ children }) {
  const { user, logout } = useApp()
  return <Shell user={user} onLogout={logout}>{children}</Shell>
}

function WizardRoute() {
  const { id } = useParams()
  return <Wizard key={id} />
}
