import { ROLES, generateTotpSecret, hashPassword, randomCode, randomId, safeEqual, verifyPassword, verifyTotp } from './security.js'

const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

export function createAuth(options = {}) {
  const users = new Map()
  const sessions = new Map()
  const failures = new Map()
  const codes = new Map()
  const now = options.now || (() => Date.now())
  const idleMs = options.idleMs ?? 20 * 60 * 1000
  const absoluteMs = options.absoluteMs ?? 8 * 60 * 60 * 1000
  const iterations = options.iterations ?? 100000

  function publicUser(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
    }
  }

  function failureState(email) {
    const state = failures.get(email) || { count: 0, lockedUntil: 0 }
    if (state.lockedUntil && state.lockedUntil <= now()) failures.set(email, { count: 0, lockedUntil: 0 })
    return failures.get(email) || { count: 0, lockedUntil: 0 }
  }

  return {
    async register({ email, password, name, role }) {
      const normalized = normalizeEmail(email)
      const passwordError = validatePassword(password)
      if (!normalized) return fail('EMAIL', 'Enter a valid email address.')
      if (passwordError) return fail('PASSWORD', passwordError)
      if (users.has(normalized)) return fail('EXISTS', 'An account with that email already exists.')
      const stored = await hashPassword(password, null, iterations)
      const verificationCode = randomCode()
      const user = {
        id: randomId(),
        email: normalized,
        name: String(name || '').trim().slice(0, 80),
        role: resolveRole(normalized, role, options.allowAdminBootstrap),
        emailVerified: false,
        mfaEnabled: false,
        totpSecret: '',
        password: stored,
        createdAt: new Date(now()).toISOString(),
      }
      users.set(normalized, user)
      codes.set(`verify:${normalized}`, { code: verificationCode, expires: now() + 30 * 60 * 1000 })
      return {
        ok: true,
        user: publicUser(user),
        delivery: { delivered: false, channel: 'development-inbox', code: verificationCode, message: 'No email was sent. This development code is shown only because an email provider is not configured.' },
      }
    },
    verifyEmail({ email, code }) {
      const normalized = normalizeEmail(email)
      const user = users.get(normalized)
      const pending = codes.get(`verify:${normalized}`)
      if (!user || !pending || pending.expires < now() || !safeEqual(pending.code, String(code || ''))) {
        return fail('CODE', 'That verification code is not valid.')
      }
      user.emailVerified = true
      codes.delete(`verify:${normalized}`)
      return { ok: true, user: publicUser(user), delivery: { delivered: false } }
    },
    async login({ email, password, otp }) {
      const normalized = normalizeEmail(email)
      const locked = failureState(normalized)
      if (locked.lockedUntil > now()) return fail('LOCKED', 'Too many attempts. Try again later.')
      const user = users.get(normalized)
      const valid = user ? await verifyPassword(password || '', user.password) : false
      if (!user || !valid) {
        const count = locked.count + 1
        failures.set(normalized, { count, lockedUntil: count >= MAX_FAILURES ? now() + LOCK_MS : 0 })
        return fail('CREDENTIALS', 'Email or password is incorrect.')
      }
      if (!user.emailVerified) return fail('UNVERIFIED', 'Verify the email address before signing in.')
      if (user.mfaEnabled) {
        const passed = await verifyTotp(user.totpSecret, otp, now())
        if (!passed) return fail('MFA', 'The authenticator code is not valid.')
      }
      failures.delete(normalized)
      const session = { id: randomId(), userId: user.id, createdAt: now(), lastSeen: now(), expiresAt: now() + absoluteMs }
      sessions.set(session.id, session)
      return { ok: true, sessionId: session.id, user: publicUser(user) }
    },
    logout(sessionId) {
      sessions.delete(sessionId)
      return { ok: true }
    },
    session(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) return null
      if (session.expiresAt <= now() || now() - session.lastSeen > idleMs) {
        sessions.delete(sessionId)
        return null
      }
      session.lastSeen = now()
      const user = [...users.values()].find((item) => item.id === session.userId)
      return user ? { sessionId, user: publicUser(user) } : null
    },
    requestPasswordReset(email) {
      const normalized = normalizeEmail(email)
      const user = users.get(normalized)
      if (user) codes.set(`reset:${normalized}`, { code: randomCode(), expires: now() + 30 * 60 * 1000 })
      const pending = codes.get(`reset:${normalized}`)
      return {
        ok: true,
        delivery: {
          delivered: false,
          channel: 'development-inbox',
          code: pending?.code || null,
          message: 'If the account exists, a development reset code is available here. No email was sent.',
        },
      }
    },
    async resetPassword({ email, code, password }) {
      const normalized = normalizeEmail(email)
      const pending = codes.get(`reset:${normalized}`)
      const passwordError = validatePassword(password)
      if (!pending || pending.expires < now() || !safeEqual(pending.code, String(code || ''))) return fail('CODE', 'That reset code is not valid.')
      if (passwordError) return fail('PASSWORD', passwordError)
      const user = users.get(normalized)
      if (!user) return fail('CODE', 'That reset code is not valid.')
      user.password = await hashPassword(password, null, iterations)
      codes.delete(`reset:${normalized}`)
      ;[...sessions.values()].filter((session) => session.userId === user.id).forEach((session) => sessions.delete(session.id))
      return { ok: true, delivery: { delivered: false } }
    },
    async enableMfa(sessionId) {
      const current = this.session(sessionId)
      if (!current) return fail('SESSION', 'Sign in again.')
      const user = [...users.values()].find((item) => item.id === current.user.id)
      user.totpSecret = generateTotpSecret()
      user.mfaEnabled = true
      return { ok: true, secret: user.totpSecret, message: 'Store this authenticator secret now. It is not an SMS message and it will not be shown again by a provider.' }
    },
    async disableMfa(sessionId, otp) {
      const current = this.session(sessionId)
      if (!current) return fail('SESSION', 'Sign in again.')
      const user = [...users.values()].find((item) => item.id === current.user.id)
      if (user.mfaEnabled && !(await verifyTotp(user.totpSecret, otp, now()))) return fail('MFA', 'The authenticator code is not valid.')
      user.mfaEnabled = false
      user.totpSecret = ''
      return { ok: true }
    },
    updateProfile(sessionId, patch) {
      const current = this.session(sessionId)
      if (!current) return fail('SESSION', 'Sign in again.')
      const user = [...users.values()].find((item) => item.id === current.user.id)
      if (patch.name) user.name = String(patch.name).trim().slice(0, 80)
      return { ok: true, user: publicUser(user) }
    },
    deleteUser(userId) {
      const user = [...users.values()].find((item) => item.id === userId)
      if (!user) return { ok: false }
      users.delete(user.email)
      ;[...sessions.entries()].forEach(([id, session]) => { if (session.userId === userId) sessions.delete(id) })
      return { ok: true }
    },
    listUsers() {
      return [...users.values()].map(publicUser)
    },
    setRole(userId, role) {
      const user = [...users.values()].find((item) => item.id === userId)
      if (!user || !ROLES.includes(role)) return fail('ROLE', 'Choose a valid role.')
      user.role = role
      return { ok: true, user: publicUser(user) }
    },
    peek(email) {
      const normalized = normalizeEmail(email)
      return {
        ok: true,
        delivered: false,
        verification: codes.get(`verify:${normalized}`)?.code || null,
        reset: codes.get(`reset:${normalized}`)?.code || null,
      }
    },
    debugCount() {
      return users.size
    },
  }
}

function resolveRole(email, requested, allow) {
  if (!allow || !email.endsWith('@xpresstax.demo') || !ROLES.includes(requested)) return 'taxpayer'
  return requested
}

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : ''
}

function validatePassword(password) {
  const value = String(password || '')
  if (value.length < 12) return 'Use at least 12 characters.'
  if (!/[a-z]/i.test(value) || !/\d/.test(value)) return 'Use at least one letter and one number.'
  if (/^password|taxslayer/i.test(value)) return 'Choose a less common password.'
  return ''
}

function fail(code, message) {
  return { ok: false, error: { code, message } }
}
