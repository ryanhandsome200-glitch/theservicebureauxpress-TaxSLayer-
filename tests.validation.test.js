import { describe, expect, it } from 'vitest'
import { createEmptyReturn } from './models.js'
import { calculateReturn } from './tax-engine.js'
import { validateReturn, validateStep } from './tax-validation.js'

describe('return validation', () => {
  it('requires taxpayer identity and a consistent filing status', () => {
    const record = createEmptyReturn('user-1')
    record.married = false
    record.filingStatus = 'mfj'
    const findings = validateStep(record, 'status')
    expect(findings.some((item) => item.severity === 'error' && item.field === 'filingStatus')).toBe(true)
  })

  it('warns on duplicate income and links the finding to the income step', () => {
    const record = createEmptyReturn('user-1')
    record.incomeItems = [
      { type: 'w2', payerName: 'North Mill', wages: 1000, confirmed: true },
      { type: 'w2', payerName: 'North Mill', wages: 1000, confirmed: true },
    ]
    const findings = validateStep(record, 'income')
    expect(findings.some((item) => item.code === 'DUPLICATE' && item.step === 'income')).toBe(true)
  })

  it('blocks submission while critical errors remain', () => {
    const record = createEmptyReturn('user-1')
    record.signature.accepted = true
    record.feesAcknowledged = true
    const calculation = calculateReturn(record)
    const validation = validateReturn(record, calculation)
    expect(validation.canSubmit).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('rejects a signature that does not match the taxpayer', () => {
    const record = createEmptyReturn('user-1')
    record.taxpayer = { firstName: 'Ada', lastName: 'Quinn', dateOfBirth: '1990-01-01' }
    record.signature = { authorization: true, name: 'Someone Else', accepted: true }
    const findings = validateStep(record, 'signature')
    expect(findings.some((item) => item.field === 'signatureName')).toBe(true)
  })
})
