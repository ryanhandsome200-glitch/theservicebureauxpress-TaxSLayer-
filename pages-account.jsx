import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Notice, PublicFooter, PublicHeader, TextInput } from './components.jsx'
import { useApp } from './store.jsx'

const bootstrap = import.meta.env.VITE_DEV_ALLOW_ADMIN_BOOTSTRAP === 'true' && !import.meta.env.PROD

export function AuthLayout({ title, lede, children }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <PublicHeader />
      <main id="main" className="auth-main">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        {children}
      </main>
      <PublicFooter />
    </>
  )
}

export function Signup() {
  const { register } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'taxpayer' })
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    const result = await register(form)
    if (!result.ok) { setError(result.error.message); return }
    navigate('/verify-email', { state: { email: form.email, code: result.delivery.code, message: result.delivery.message } })
  }
  return (
    <AuthLayout title="Create an account" lede="The sandbox keeps the password hash in memory. It does not send email.">
      <form className="stack" onSubmit={submit}>
        <TextInput id="name" label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} autoComplete="name" />
        <TextInput id="email" label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} autoComplete="email" />
        <TextInput id="password" label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="new-password" hint="At least 12 characters, with a letter and a number." />
        {bootstrap ? (
          <label className="field" htmlFor="role"><span>Development role</span>
            <select id="role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="taxpayer">Taxpayer</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
              <option value="rules_admin">Rules admin</option>
            </select>
          </label>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className="btn btn-primary" type="submit">Create account</button>
      </form>
    </AuthLayout>
  )
}

export function VerifyEmail() {
  const { verifyEmail, developmentInbox } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [code, setCode] = useState(location.state?.code || '')
  const [message, setMessage] = useState(location.state?.message || 'No email was sent.')
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    const result = verifyEmail({ email, code })
    if (!result.ok) { setError(result.error.message); return }
    navigate('/login', { state: { email } })
  }
  function reveal() {
    const inbox = developmentInbox(email)
    setCode(inbox.verification || '')
    setMessage(inbox.verification ? 'Development code loaded. No email was sent.' : 'No development code is waiting for that address.')
  }
  return (
    <AuthLayout title="Verify your email" lede={message}>
      <form className="stack" onSubmit={submit}>
        <TextInput id="email" label="Email" type="email" value={email} onChange={setEmail} />
        <TextInput id="code" label="Verification code" value={code} onChange={setCode} />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className="btn btn-primary" type="submit">Verify</button>
        <button className="btn btn-secondary" type="button" onClick={reveal}>Show development code</button>
      </form>
    </AuthLayout>
  )
}

export function Login() {
  const { login, user } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: location.state?.email || '', password: '', otp: '' })
  const [error, setError] = useState('')
  if (user?.emailVerified) return <Navigate to="/dashboard" replace />
  async function submit(event) {
    event.preventDefault()
    const result = await login(form)
    if (!result.ok) { setError(result.error.message); return }
    navigate(location.state?.from || '/dashboard')
  }
  return (
    <AuthLayout title="Log in" lede="Use the account you just verified. A locked account has to wait 15 minutes.">
      <form className="stack" onSubmit={submit}>
        <TextInput id="email" label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} autoComplete="username" />
        <TextInput id="password" label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="current-password" />
        <TextInput id="otp" label="Authenticator code" value={form.otp} onChange={(otp) => setForm({ ...form, otp })} hint="Leave blank unless you enrolled an authenticator." />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className="btn btn-primary" type="submit">Log in</button>
        <Link to="/forgot-password">Forgot password</Link>
      </form>
    </AuthLayout>
  )
}

export function ForgotPassword() {
  const { requestPasswordReset } = useApp()
  const [email, setEmail] = useState('')
  const [delivery, setDelivery] = useState(null)
  function submit(event) {
    event.preventDefault()
    setDelivery(requestPasswordReset(email).delivery)
  }
  return (
    <AuthLayout title="Reset a password" lede="If the address is registered, the development code appears below. No email is sent.">
      <form className="stack" onSubmit={submit}>
        <TextInput id="email" label="Email" type="email" value={email} onChange={setEmail} />
        <button className="btn btn-primary" type="submit">Create reset code</button>
      </form>
      {delivery ? <Notice>{delivery.message} {delivery.code ? `Code: ${delivery.code}` : ''}</Notice> : null}
      <Link to="/reset-password">Enter a reset code</Link>
    </AuthLayout>
  )
}

export function ResetPassword() {
  const { resetPassword } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', code: '', password: '' })
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    const result = await resetPassword(form)
    if (!result.ok) { setError(result.error.message); return }
    navigate('/login')
  }
  return (
    <AuthLayout title="Choose a new password" lede="A successful reset signs out existing sandbox sessions.">
      <form className="stack" onSubmit={submit}>
        <TextInput id="email" label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <TextInput id="code" label="Reset code" value={form.code} onChange={(code) => setForm({ ...form, code })} />
        <TextInput id="password" label="New password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <button className="btn btn-primary" type="submit">Update password</button>
      </form>
    </AuthLayout>
  )
}

export function Account() {
  const { user, updateProfile, enableMfa, disableMfa, deleteAccount } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [otp, setOtp] = useState('')
  const [secret, setSecret] = useState('')
  const [message, setMessage] = useState('')
  return (
    <section className="stack">
      <h1>Account</h1>
      <p className="muted">{user.email} · {user.role}</p>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); const result = updateProfile({ name }); setMessage(result.ok ? 'Name saved in this session.' : result.error.message) }}>
        <TextInput id="profile-name" label="Name" value={name} onChange={setName} />
        <button className="btn btn-primary" type="submit">Save profile</button>
      </form>
      <h2>Authenticator</h2>
      <button className="btn btn-secondary" type="button" onClick={async () => { const result = await enableMfa(); setSecret(result.secret || ''); setMessage(result.message || result.error?.message) }}>Enroll authenticator</button>
      {secret ? <Notice>Secret: {secret}. This was not sent by SMS.</Notice> : null}
      <form className="stack" onSubmit={async (event) => { event.preventDefault(); const result = await disableMfa(otp); setMessage(result.ok ? 'Authenticator removed.' : result.error.message) }}>
        <TextInput id="disable-otp" label="Current code to turn off MFA" value={otp} onChange={setOtp} />
        <button className="btn btn-secondary" type="submit">Turn off authenticator</button>
      </form>
      <h2>Delete account</h2>
      <button className="btn btn-secondary" type="button" onClick={() => { deleteAccount(); navigate('/') }}>Delete this sandbox account</button>
      {message ? <Notice>{message}</Notice> : null}
    </section>
  )
}
