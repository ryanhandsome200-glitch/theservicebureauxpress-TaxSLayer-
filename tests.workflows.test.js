import { beforeEach, describe, expect, it } from 'vitest'
import { createAppBackend } from './repository.js'
import { deserializeReturn, serializeReturn } from './models.js'

const password = 'Correct-Horse-12'

async function verifiedUser(app, email, role) {
  const registered = await app.register({ email, password, name: 'Test User', role })
  expect(registered.ok).toBe(true)
  expect(registered.delivery.delivered).toBe(false)
  const verified = app.verifyEmail({ email, code: registered.delivery.code })
  expect(verified.ok).toBe(true)
  const loggedIn = await app.login({ email, password })
  expect(loggedIn.ok).toBe(true)
  return loggedIn.user
}

function validPatch(name = 'Ada Quinn') {
  const [firstName, lastName] = name.split(' ')
  return {
    taxYear: 2025,
    married: false,
    taxpayer: { firstName, lastName, dateOfBirth: '1990-06-01', blind: false, claimedAsDependent: false, tinLast4: '9876', occupation: '' },
    filingStatus: 'single',
    address: { line1: '1 Market Street', city: 'Austin', state: 'TX', postalCode: '78701', residency: 'full-year' },
    stateReturn: { prepare: false, additions: 0, subtractions: 0, acknowledgeFederalOnly: true },
    incomeItems: [{ id: 'w2-1', type: 'w2', payerName: 'North Mill', wages: 60000, federalWithholding: 5000, confirmed: true, source: 'manual' }],
    productId: 'essential',
    credits: { claimCtc: false, claimEitc: false, claimEducation: false },
    signature: { accepted: true, authorization: true, name: `${firstName} ${lastName}`, date: '2026-10-20' },
    step: 'submit',
  }
}

describe('application workflows', () => {
  let app

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    app = createAppBackend({ allowAdminBootstrap: true, iterations: 1000, mode: 'development-sandbox' })
  })

  it('locks a session after idle time and after repeated login failures', async () => {
    let now = Date.now()
    const clocked = createAppBackend({ allowAdminBootstrap: true, iterations: 1000, now: () => now, idleMs: 1000 })
    await verifiedUser(clocked, 'idle@example.com')
    now += 5000
    expect(clocked.session().user).toBeNull()

    await verifiedUser(app, 'lock@example.com')
    app.logout()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await app.login({ email: 'lock@example.com', password: 'wrong-password-1' })
      expect(failed.ok).toBe(false)
    }
    const locked = await app.login({ email: 'lock@example.com', password })
    expect(locked.error.code).toBe('LOCKED')
  })

  it('saves, edits, recalculates, and resumes a return without browser storage', async () => {
    await verifiedUser(app, 'filer@example.com')
    const created = app.createReturn()
    const saved = app.saveReturn(created.return.id, validPatch())
    expect(saved.ok).toBe(true)
    expect(saved.return.calculation.result.amountDue).toBe(75)
    const edited = app.saveReturn(created.return.id, { incomeItems: [{ id: 'w2-1', type: 'w2', payerName: 'North Mill', wages: 60000, federalWithholding: 8000, confirmed: true, source: 'manual' }] })
    expect(edited.return.calculation.result.refund).toBe(2925)
    const loaded = app.getReturn(created.return.id)
    expect(loaded.return.version).toBeGreaterThan(1)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    const roundTrip = deserializeReturn(serializeReturn(loaded.return))
    expect(roundTrip.taxpayer.firstName).toBe('Ada')
    expect(roundTrip.documents.every((document) => !document.content)).toBe(true)
  })

  it('keeps another user from reading a return and redacts administrative summaries', async () => {
    await verifiedUser(app, 'owner@example.com')
    const created = app.createReturn()
    app.saveReturn(created.return.id, validPatch())
    app.logout()
    await verifiedUser(app, 'other@example.com')
    expect(app.getReturn(created.return.id).ok).toBe(false)
    app.logout()
    await verifiedUser(app, 'admin@xpresstax.demo', 'admin')
    const summaries = app.adminListReturns()
    expect(JSON.stringify(summaries)).not.toContain('9876')
    expect(summaries[0].taxpayer.tinLast4).toBeUndefined()
    expect(() => app.getReturn(created.return.id)).not.toThrow()
    expect(app.getReturn(created.return.id).ok).toBe(false)
  })

  it('does not mark a sandbox filing or payment as accepted or paid', async () => {
    await verifiedUser(app, 'pay@example.com')
    const created = app.createReturn()
    app.saveReturn(created.return.id, validPatch())
    const checkout = app.createCheckout(created.return.id)
    expect(checkout.payment.paid).toBe(false)
    expect(checkout.payment.cardStored).toBe(false)
    const verification = app.verifyPayment(created.return.id)
    expect(verification.verification.verified).toBe(false)
    const first = app.submitFiling(created.return.id)
    const second = app.submitFiling(created.return.id)
    expect(first.filing.submitted).toBe(false)
    expect(first.filing.accepted).toBe(false)
    expect(first.filing.submissionId).toBeNull()
    expect(second.duplicate).toBe(true)
    expect(second.filing.idempotencyKey).toBe(first.filing.idempotencyKey)
  })

  it('does not fall back to memory when the API cannot be reached', async () => {
    const remote = createAppBackend({
      mode: 'development-api',
      apiBaseUrl: 'https://api.example.test',
      iterations: 1000,
      fetchImpl: async () => { throw new Error('down') },
    })
    const result = await remote.register({ email: 'remote@example.com', password, name: 'Remote' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('NETWORK')
    expect(remote.debugUserCount()).toBe(0)
    const created = await remote.createReturn()
    expect(created.error.code).toBe('NETWORK')
    expect(remote.debugReturnCount()).toBe(0)
    expect(remote.listReturns()).toEqual([])
    const production = createAppBackend({ mode: 'production', apiBaseUrl: '', iterations: 1000 })
    expect((await production.register({ email: 'prod@example.com', password, name: 'Prod' })).error.code).toBe('CONFIG')
  })

  it('requires an authenticator code after MFA enrollment', async () => {
    await verifiedUser(app, 'mfa@example.com')
    const enrolled = await app.enableMfa()
    expect(enrolled.secret).toBeTruthy()
    app.logout()
    const missing = await app.login({ email: 'mfa@example.com', password })
    expect(missing.error.code).toBe('MFA')
    const { totpCode } = await import('./security.js')
    const code = await totpCode(enrolled.secret)
    const passed = await app.login({ email: 'mfa@example.com', password, otp: code })
    expect(passed.ok).toBe(true)
  })
})
