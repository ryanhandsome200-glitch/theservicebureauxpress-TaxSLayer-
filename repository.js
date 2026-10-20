import { createAuth } from './auth.js'
import { createApiClient } from './api-client.js'
import { extractionResult, validateUpload } from './document-adapter.js'
import { createSandboxSubmission, sameSubmission } from './filing-adapter.js'
import { createEmptyReturn, deserializeReturn, serializeReturn } from './models.js'
import { notificationsFor } from './notifications.js'
import { createSandboxCheckout, verifySandboxPayment } from './payment-adapter.js'
import { assertPermission, randomId, redactRecord, redactReturnSummary } from './security.js'
import { calculateReturn } from './tax-engine.js'
import { quoteFees, recommendedProduct } from './tax-rules.js'
import { completionRatio, validateReturn } from './tax-validation.js'

export function createAppBackend(options = {}) {
  const mode = options.mode || 'development-sandbox'
  const apiBaseUrl = options.apiBaseUrl || ''
  const remote = Boolean(apiBaseUrl) && mode !== 'development-sandbox'
  const productionBlocked = mode === 'production' && !apiBaseUrl
  const auth = createAuth(options)
  const returns = new Map()
  const tickets = new Map()
  const audit = []
  const flags = { sandboxFilingEnabled: true, registrationEnabled: true }
  let sessionId = null
  let remoteUser = null
  let api = null

  function currentUser() {
    if (remote) return remoteUser
    if (!sessionId) return null
    return auth.session(sessionId)?.user || null
  }

  function log(user, action, entityType, entityId, detail) {
    audit.push({
      id: randomId(),
      at: new Date().toISOString(),
      actorId: user?.id || null,
      action,
      entityType,
      entityId,
      detail: redactRecord(detail || {}),
    })
  }

  function own(id) {
    const user = currentUser()
    const record = returns.get(id)
    if (!user || !record || record.userId !== user.id) return null
    return record
  }

  function client() {
    if (!api) api = createApiClient({ baseUrl: apiBaseUrl, fetchImpl: options.fetchImpl })
    return api
  }

  async function remoteRequest(path, request) {
    const result = await client().request(path, request)
    return result.ok ? { ok: true, ...result.data } : result
  }

  function remember(record) {
    const calculation = calculateReturn(record)
    const validation = validateReturn(record, calculation)
    record.calculation = calculation
    record.validation = validation
    record.completion = completionRatio(record, calculation)
    record.updatedAt = new Date().toISOString()
    returns.set(record.id, record)
    return record
  }

  return {
    mode: productionBlocked ? 'production-unconfigured' : remote ? mode : 'development-sandbox',
    async register(input) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest('/v1/auth/register', { method: 'POST', body: input })
      if (!flags.registrationEnabled) return { ok: false, error: { code: 'CLOSED', message: 'Registration is turned off.' } }
      const result = await auth.register(input)
      if (result.ok) log(result.user, 'register', 'user', result.user.id, { email: result.user.email })
      return result
    },
    verifyEmail(input) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest('/v1/auth/verify-email', { method: 'POST', body: input })
      return auth.verifyEmail(input)
    },
    async login(input) {
      if (productionBlocked) return configError()
      if (remote) {
        const result = await remoteRequest('/v1/auth/login', { method: 'POST', body: input })
        if (!result.ok) return result
        try {
          remoteUser = client().parseSession(result.user)
        } catch (error) {
          remoteUser = null
          return { ok: false, error: { code: 'BAD_RESPONSE', message: error.message } }
        }
        return { ok: true, user: remoteUser }
      }
      const result = await auth.login(input)
      if (!result.ok) {
        log(null, 'login-failed', 'user', input?.email || '', {})
        return result
      }
      sessionId = result.sessionId
      log(result.user, 'login', 'session', result.sessionId, {})
      return { ok: true, user: result.user }
    },
    logout() {
      remoteUser = null
      if (remote) return remoteRequest('/v1/auth/logout', { method: 'POST' })
      if (sessionId) auth.logout(sessionId)
      sessionId = null
      return { ok: true }
    },
    session() {
      if (productionBlocked) return { user: null, configured: false }
      if (remote) return { user: remoteUser, configured: true, mode: this.mode }
      const user = currentUser()
      return { user, configured: !productionBlocked, mode: this.mode }
    },
    developmentInbox(email) {
      if (this.mode !== 'development-sandbox') return { ok: false, error: { code: 'UNAVAILABLE', message: 'Codes are delivered only by a configured provider.' } }
      return auth.peek(email)
    },
    requestPasswordReset(email) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest('/v1/auth/forgot-password', { method: 'POST', body: { email } })
      return auth.requestPasswordReset(email)
    },
    resetPassword(input) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest('/v1/auth/reset-password', { method: 'POST', body: input })
      return auth.resetPassword(input)
    },
    enableMfa() {
      if (remote) return remoteRequest('/v1/auth/mfa', { method: 'POST', body: {} })
      return auth.enableMfa(sessionId)
    },
    disableMfa(otp) {
      if (remote) return remoteRequest('/v1/auth/mfa', { method: 'DELETE', body: { otp } })
      return auth.disableMfa(sessionId, otp)
    },
    updateProfile(patch) {
      if (remote) return remoteRequest('/v1/profile', { method: 'PUT', body: patch })
      const result = auth.updateProfile(sessionId, patch)
      if (result.ok) log(result.user, 'profile', 'user', result.user.id, {})
      return result
    },
    deleteAccount() {
      const user = currentUser()
      if (!user) return { ok: false, error: { code: 'SESSION', message: 'Sign in again.' } }
      if (remote) return remoteRequest('/v1/profile', { method: 'DELETE' })
      ;[...returns.values()].filter((record) => record.userId === user.id).forEach((record) => returns.delete(record.id))
      auth.deleteUser(user.id)
      sessionId = null
      log(user, 'delete-account', 'user', user.id, {})
      return { ok: true }
    },
    listReturns() {
      if (productionBlocked || remote) return []
      const user = currentUser()
      if (!user) return []
      return [...returns.values()].filter((record) => record.userId === user.id).map(publicReturn)
    },
    createReturn() {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest('/v1/returns', { method: 'POST', body: {} })
      const user = currentUser()
      if (!user) return { ok: false, error: { code: 'SESSION', message: 'Sign in again.' } }
      const record = remember(createEmptyReturn(user.id))
      record.activity = [{ at: record.updatedAt, text: 'Return created.' }]
      log(user, 'create-return', 'return', record.id, {})
      return { ok: true, return: publicReturn(record) }
    },
    getReturn(id) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest(`/v1/returns/${encodeURIComponent(id)}`)
      const record = own(id)
      if (!record) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      return { ok: true, return: publicReturn(record) }
    },
    saveReturn(id, patch) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest(`/v1/returns/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })
      const user = currentUser()
      const current = own(id)
      if (!current) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      let merged
      try {
        merged = deserializeReturn({ ...serializeReturn(current), ...patch, id: current.id, userId: current.userId })
      } catch (error) {
        return { ok: false, error: { code: 'PAYLOAD', message: error.message } }
      }
      merged.filing = current.filing
      merged.payment = current.payment
      merged.status = ['accepted', 'rejected', 'submitted', 'filed'].includes(patch.status) ? current.status : (patch.status || current.status)
      merged.version = current.version + 1
      merged.activity = [...(current.activity || []), { at: new Date().toISOString(), text: `Saved ${merged.step || 'return'}.` }].slice(-20)
      const snapshot = serializeReturn({ ...merged, versions: [] })
      merged.versions = [...(current.versions || []), { version: merged.version, savedAt: new Date().toISOString(), step: merged.step, snapshot }].slice(-5)
      remember(merged)
      log(user, 'save-return', 'return', id, { step: merged.step, version: merged.version })
      return { ok: true, return: publicReturn(merged) }
    },
    restoreVersion(id, version) {
      const current = own(id)
      const entry = current?.versions?.find((item) => item.version === version)
      if (!entry) return { ok: false, error: { code: 'VERSION', message: 'That saved version is not available.' } }
      return this.saveReturn(id, { ...entry.snapshot, version: current.version })
    },
    deleteReturn(id) {
      const user = currentUser()
      if (!own(id)) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      returns.delete(id)
      log(user, 'delete-return', 'return', id, {})
      return { ok: true }
    },
    addDocument(id, file) {
      if (productionBlocked) return configError()
      if (remote) return { ok: false, error: { code: 'UNAVAILABLE', message: 'Document upload has to go through the secure API. This browser did not keep the file.' } }
      const record = own(id)
      if (!record) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      const upload = validateUpload(file)
      if (!upload.ok) return { ok: false, error: { code: 'UPLOAD', message: upload.error } }
      const document = {
        id: randomId(),
        name: String(file.name || 'document').slice(0, 120),
        type: file.type,
        size: file.size,
        status: 'stored-metadata',
        extraction: extractionResult(),
        createdAt: new Date().toISOString(),
      }
      record.documents = [...record.documents, document]
      remember(record)
      return { ok: true, document, return: publicReturn(record) }
    },
    deleteDocument(id, documentId) {
      if (productionBlocked) return configError()
      if (remote) return { ok: false, error: { code: 'UNAVAILABLE', message: 'Document removal has to go through the secure API. This browser did not keep the file.' } }
      const record = own(id)
      if (!record) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      record.documents = record.documents.filter((document) => document.id !== documentId)
      remember(record)
      return { ok: true, return: publicReturn(record) }
    },
    createCheckout(id) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest(`/v1/returns/${encodeURIComponent(id)}/checkout`, { method: 'POST', body: {} })
      const record = own(id)
      if (!record) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      const quote = quoteFees(record.productId, Boolean(record.calculation?.result?.state?.prepared))
      if (!quote) return { ok: false, error: { code: 'PRODUCT', message: 'Choose a preparation option before checkout.' } }
      record.payment = createSandboxCheckout(quote)
      record.feesAcknowledged = true
      remember(record)
      return { ok: true, payment: record.payment, quote, return: publicReturn(record) }
    },
    verifyPayment(id) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest(`/v1/returns/${encodeURIComponent(id)}/payment`, { method: 'GET' })
      const record = own(id)
      if (!record) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      const verification = verifySandboxPayment(record)
      if (record.payment) record.payment = { ...record.payment, ...verification, paid: false }
      return { ok: true, verification, return: publicReturn(record) }
    },
    submitFiling(id) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest(`/v1/returns/${encodeURIComponent(id)}/filing`, { method: 'POST', body: {}, idempotencyKey: id })
      const user = currentUser()
      const record = own(id)
      if (!record) return { ok: false, error: { code: 'NOT_FOUND', message: 'That return is not available.' } }
      const validation = validateReturn(record, record.calculation)
      if (!record.payment || record.payment.paid) {
        return { ok: false, error: { code: 'PAYMENT', message: 'Review the unpaid fee summary before submission. This application will not mark an order paid.' } }
      }
      if (!validation.canSubmit || record.calculation?.result?.blockers?.length) {
        return { ok: false, error: { code: 'INVALID', message: 'Resolve the blocking items before submission.' }, validation }
      }
      if (!flags.sandboxFilingEnabled) return { ok: false, error: { code: 'FILING_OFF', message: 'Sandbox filing is turned off.' } }
      const idempotencyKey = record.filing?.idempotencyKey || randomId()
      if (sameSubmission(record.filing, idempotencyKey)) return { ok: true, filing: record.filing, return: publicReturn(record), duplicate: true }
      record.filing = createSandboxSubmission(idempotencyKey)
      record.status = 'sandbox_not_submitted'
      record.activity = [...record.activity, { at: new Date().toISOString(), text: 'Sandbox filing recorded. Nothing was submitted.' }]
      remember(record)
      log(user, 'sandbox-filing', 'return', id, { environment: 'sandbox', submitted: false })
      return { ok: true, filing: record.filing, return: publicReturn(record), duplicate: false }
    },
    createTicket(input) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest('/v1/tickets', { method: 'POST', body: input })
      const user = currentUser()
      if (!text(input?.subject) || !text(input?.message)) return { ok: false, error: { code: 'TICKET', message: 'Enter a subject and a message.' } }
      const ticket = {
        id: randomId(),
        userId: user?.id || null,
        email: user?.email || String(input.email || '').slice(0, 120),
        subject: String(input.subject).slice(0, 140),
        message: String(input.message).slice(0, 4000),
        status: 'open',
        createdAt: new Date().toISOString(),
        delivery: { delivered: false, message: 'The request is stored in this session. No email was sent.' },
      }
      tickets.set(ticket.id, ticket)
      log(user, 'ticket', 'ticket', ticket.id, { subject: ticket.subject })
      return { ok: true, ticket }
    },
    listMyTickets() {
      const user = currentUser()
      if (!user) return []
      return [...tickets.values()].filter((ticket) => ticket.userId === user.id)
    },
    notifications() {
      if (productionBlocked || remote) return []
      const user = currentUser()
      if (!user) return []
      return [...returns.values()].filter((record) => record.userId === user.id).flatMap((record) => notificationsFor(record))
    },
    adminListUsers() {
      if (remote || productionBlocked) return []
      const user = currentUser()
      assertPermission(user, 'admin.users')
      return auth.listUsers().map((item) => ({ id: item.id, role: item.role, emailVerified: item.emailVerified, name: item.name }))
    },
    adminSetRole(userId, role) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest(`/v1/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PUT', body: { role } })
      const user = currentUser()
      assertPermission(user, 'admin.users')
      const result = auth.setRole(userId, role)
      if (result.ok) log(user, 'set-role', 'user', userId, { role })
      return result
    },
    adminListReturns() {
      if (remote || productionBlocked) return []
      const user = currentUser()
      assertPermission(user, 'admin.metrics')
      return [...returns.values()].map(redactReturnSummary)
    },
    adminListPayments() {
      if (remote || productionBlocked) return []
      const user = currentUser()
      assertPermission(user, 'admin.payments')
      return [...returns.values()].filter((record) => record.payment).map((record) => ({
        returnId: record.id,
        status: record.payment.status,
        amount: record.payment.amount,
        verified: false,
        paid: false,
      }))
    },
    adminListTickets() {
      if (remote || productionBlocked) return []
      const user = currentUser()
      assertPermission(user, 'admin.tickets')
      return [...tickets.values()].map((ticket) => ({ ...ticket, email: maskEmail(ticket.email) }))
    },
    adminUpdateTicket(id, status) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest(`/v1/admin/tickets/${encodeURIComponent(id)}`, { method: 'PUT', body: { status } })
      const user = currentUser()
      assertPermission(user, 'admin.tickets')
      const ticket = tickets.get(id)
      if (!ticket) return { ok: false, error: { code: 'NOT_FOUND', message: 'Ticket not found.' } }
      if (!['open', 'closed'].includes(status)) return { ok: false, error: { code: 'STATUS', message: 'Choose open or closed.' } }
      ticket.status = status
      return { ok: true, ticket }
    },
    adminAudit() {
      if (remote || productionBlocked) return []
      const user = currentUser()
      assertPermission(user, 'admin.audit')
      return audit.map((event) => ({ ...event, detail: redactRecord(event.detail) }))
    },
    adminMetrics() {
      if (remote || productionBlocked) return null
      const user = currentUser()
      assertPermission(user, 'admin.metrics')
      const all = [...returns.values()]
      return {
        users: auth.listUsers().length,
        returns: all.length,
        sandboxFilings: all.filter((record) => record.filing?.environment === 'sandbox').length,
        unpaidOrders: all.filter((record) => record.payment && record.payment.paid === false).length,
        openTickets: [...tickets.values()].filter((ticket) => ticket.status === 'open').length,
      }
    },
    adminFlags() {
      if (remote || productionBlocked) return {}
      const user = currentUser()
      assertPermission(user, 'admin.rules')
      return { ...flags }
    },
    adminSetFlag(name, value) {
      if (productionBlocked) return configError()
      if (remote) return remoteRequest('/v1/admin/flags', { method: 'PUT', body: { name, value } })
      const user = currentUser()
      assertPermission(user, 'admin.rules')
      if (!Object.hasOwn(flags, name)) return { ok: false, error: { code: 'FLAG', message: 'Unknown setting.' } }
      flags[name] = Boolean(value)
      log(user, 'flag', 'config', name, { value: flags[name] })
      return { ok: true, flags: { ...flags } }
    },
    rulesOverview() {
      return { recommendedExample: recommendedProduct({ filingStatus: 'single', incomeItems: [], dependents: [] }) }
    },
    debugUserCount() { return auth.debugCount() },
    debugReturnCount() { return returns.size },
    debugAudit() { return audit },
  }
}

function publicReturn(record) {
  return {
    ...record,
    documents: (record.documents || []).map(({ content: _content, bytes: _bytes, dataUrl: _dataUrl, ...document }) => document),
  }
}

function configError() {
  return { ok: false, error: { code: 'CONFIG', message: 'Production mode needs a secure API. Taxpayer records were not stored in this browser.' } }
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@')
  if (!domain) return ''
  return `${name.slice(0, 1)}***@${domain}`
}

export function browserBackendOptions(env = import.meta.env) {
  const dataMode = env.VITE_DATA_MODE || 'development'
  const apiBaseUrl = env.VITE_API_BASE_URL || ''
  let mode = 'development-sandbox'
  if (dataMode === 'production') mode = 'production'
  else if (apiBaseUrl) mode = 'development-api'
  return {
    mode,
    apiBaseUrl,
    allowAdminBootstrap: env.VITE_DEV_ALLOW_ADMIN_BOOTSTRAP === 'true' && !env.PROD,
    iterations: 20000,
  }
}

export const backend = createAppBackend(browserBackendOptions())
