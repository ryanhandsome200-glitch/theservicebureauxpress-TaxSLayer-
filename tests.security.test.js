import { describe, expect, it } from 'vitest'
import { createApiClient } from './api-client.js'
import { inspectPublicEnv, redactText, totpCode, verifyTotp } from './security.js'

describe('security helpers', () => {
  it('redacts taxpayer identification numbers', () => {
    expect(redactText('SSN 123-45-6789')).toBe('SSN ***-**-****')
  })

  it('rejects private material in public environment variables', () => {
    const issues = inspectPublicEnv({ VITE_API_SECRET: 'sk_live_example', PROD: true, VITE_DEV_ALLOW_ADMIN_BOOTSTRAP: 'true' })
    expect(issues.length).toBeGreaterThan(0)
    expect(inspectPublicEnv({ MODE: 'production', PROD: true })).toEqual([])
  })

  it('matches the RFC 6238 SHA-1 test vector', async () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(await totpCode(secret, 59 * 1000)).toBe('287082')
    expect(await verifyTotp(secret, '287082', 59 * 1000)).toBe(true)
    expect(await verifyTotp(secret, '000000', 59 * 1000)).toBe(false)
  })

  it('rejects an API session payload with an unknown role', () => {
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetchImpl: async () => ({ ok: true, text: async () => '{}' }) })
    expect(() => client.parseSession({ id: '1', email: 'a@example.com', role: 'owner' })).toThrow(/role/i)
  })

  it('reports a network failure without inventing data', async () => {
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetchImpl: async () => { throw new Error('down') } })
    const result = await client.request('/v1/session')
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('NETWORK')
  })
})
