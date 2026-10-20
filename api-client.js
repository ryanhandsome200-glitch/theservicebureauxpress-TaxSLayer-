const ROLES = new Set(['taxpayer', 'support', 'admin', 'rules_admin'])

export function createApiClient({ baseUrl, fetchImpl = globalThis.fetch } = {}) {
  if (!baseUrl) throw new Error('API base URL is required.')

  async function request(path, { method = 'GET', body, idempotencyKey } = {}) {
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await response.text()
      let payload = null
      if (text) {
        try {
          payload = JSON.parse(text)
        } catch {
          return { ok: false, error: { code: 'BAD_RESPONSE', message: 'The API returned an unreadable response.' } }
        }
      }
      if (!response.ok) {
        return { ok: false, error: { code: payload?.error?.code || 'API_ERROR', message: payload?.error?.message || 'The API request failed.' } }
      }
      return { ok: true, data: payload }
    } catch {
      return { ok: false, error: { code: 'NETWORK', message: 'The API could not be reached. Nothing was saved in this browser.' } }
    }
  }

  return {
    request,
    parseSession(payload) {
      if (!payload || typeof payload !== 'object') throw new Error('Invalid session response')
      if (typeof payload.id !== 'string' || typeof payload.email !== 'string') throw new Error('Invalid session response')
      if (!ROLES.has(payload.role)) throw new Error('Invalid role')
      return { id: payload.id, email: payload.email, role: payload.role, name: String(payload.name || ''), emailVerified: Boolean(payload.emailVerified) }
    },
  }
}
