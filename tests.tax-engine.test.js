import { describe, expect, it } from 'vitest'
import {
  calculateChildTaxCredit,
  calculateEitc,
  calculateReturn,
  computeSelfEmploymentTax,
  netCapital,
  ordinaryIncomeTax,
  saltDeduction,
  standardDeductionAmount,
  studentLoanDeduction,
} from './tax-engine.js'
import { getTaxYearRules } from './tax-rules.js'

const rules = getTaxYearRules(2025)

function ret(overrides = {}) {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: { firstName: 'Ada', lastName: 'Quinn', dateOfBirth: '1990-06-01', blind: false },
    spouse: {},
    address: { state: 'TX', residency: 'full-year' },
    dependents: [],
    incomeItems: [],
    adjustments: {},
    deductions: { choice: 'larger' },
    credits: {},
    payments: { estimatedFederal: 0, estimatedState: 0 },
    stateReturn: { prepare: true, additions: 0, subtractions: 0, acknowledgeFederalOnly: true },
    eligibility: {},
    ...overrides,
  }
}

describe('2025 federal calculations', () => {
  it('rejects a tax year that is not loaded', () => {
    const result = calculateReturn(ret({ taxYear: 2024 }))
    expect(result.ok).toBe(false)
    expect(result.result).toBeNull()
  })

  it('uses the tax table midpoint for taxable income under $100,000', () => {
    const result = calculateReturn(ret({
      incomeItems: [{ type: 'w2', wages: 60000, federalWithholding: 5000, confirmed: true }],
    }))
    expect(result.result.taxableIncome).toBe(44250)
    expect(result.result.incomeTax.method).toBe('tax-table')
    expect(result.result.incomeTax.taxedAmount).toBe(44275)
    expect(result.result.incomeTax.tax).toBe(5075)
    expect(result.result.amountDue).toBe(75)
    expect(result.result.refund).toBe(0)
    expect(result.result.estimateNotice).toMatch(/not a filed return/i)
  })

  it('uses the rate schedule at and above $100,000', () => {
    const high = ordinaryIncomeTax(100000, 'single', rules)
    expect(high.method).toBe('worksheet')
    expect(high.tax).toBe(16914)
    const below = ordinaryIncomeTax(99950, 'single', rules)
    expect(below.method).toBe('tax-table')
    expect(below.taxedAmount).toBe(99975)
    expect(below.tax).toBe(16909)
  })

  it('calculates a joint return from the 2025 standard deduction and tax table', () => {
    const result = calculateReturn(ret({
      filingStatus: 'mfj',
      incomeItems: [{ type: 'w2', wages: 100000, federalWithholding: 0, confirmed: true }],
    }))
    expect(result.result.deduction.amount).toBe(31500)
    expect(result.result.taxableIncome).toBe(68500)
    expect(result.result.incomeTax.tax).toBe(7746)
  })

  it('adds the unmarried additional standard deduction for age 65', () => {
    expect(standardDeductionAmount(rules, 'single', { taxpayerAge65: true })).toBe(17750)
    expect(standardDeductionAmount(rules, 'mfj', { taxpayerAge65: true, spouseAge65: true })).toBe(34700)
    expect(standardDeductionAmount(rules, 'single', { claimedAsDependent: true, earnedIncome: 8000 })).toBe(8450)
  })

  it('applies the 2025 SALT cap and phase-down', () => {
    expect(saltDeduction(rules, 'single', 100000, 50000)).toBe(40000)
    expect(saltDeduction(rules, 'single', 600000, 50000)).toBe(10000)
    expect(saltDeduction(rules, 'mfs', 300000, 40000)).toBe(12500)
    expect(saltDeduction(rules, 'mfs', 100000, 5000)).toBe(5000)
  })

  it('computes self-employment tax from the 2025 wage base', () => {
    const tax = computeSelfEmploymentTax(10000, 0, rules)
    expect(tax.base).toBe(9235)
    expect(tax.tax).toBe(1413)
    expect(tax.deductibleHalf).toBe(707)
    expect(computeSelfEmploymentTax(400, 0, rules).tax).toBe(0)
    expect(computeSelfEmploymentTax(10000, 176100, rules).tax).toBe(268)
  })

  it('limits the earned income credit with the published maximum and phaseout', () => {
    expect(calculateEitc(rules, 'single', 0, 10000, 10000, 0).amount).toBe(649)
    expect(calculateEitc(rules, 'single', 1, 30000, 30000, 0).amount).toBe(3265)
    expect(calculateEitc(rules, 'single', 0, 10000, 10000, 12000).amount).toBe(0)
  })

  it('phases out the child tax credit by $50 per $1,000 or fraction', () => {
    expect(calculateChildTaxCredit(rules, 'single', 1, 200000, 10000, 30000).nonrefundable).toBe(2200)
    expect(calculateChildTaxCredit(rules, 'single', 1, 200001, 10000, 30000).nonrefundable).toBe(2150)
    const refundable = calculateChildTaxCredit(rules, 'single', 1, 20000, 0, 10000)
    expect(refundable.nonrefundable).toBe(0)
    expect(refundable.refundable).toBe(1125)
  })

  it('does not deduct student loan interest for married filing separately', () => {
    expect(studentLoanDeduction(rules, 'mfs', 2000, 40000).amount).toBe(0)
    expect(studentLoanDeduction(rules, 'single', 2500, 85000).amount).toBe(2500)
    expect(studentLoanDeduction(rules, 'single', 2500, 100000).amount).toBe(0)
  })

  it('allows a net capital loss of $3,000 and carries the rest', () => {
    expect(netCapital(-10000, 0, 3000)).toEqual({ shortTerm: 0, longTerm: 0, lossDeduction: 3000, carryover: 7000 })
    const result = calculateReturn(ret({
      incomeItems: [
        { type: 'w2', wages: 50000, federalWithholding: 0, confirmed: true },
        { type: 'capital-gain', proceeds: 0, basis: 10000, term: 'short', confirmed: true },
      ],
    }))
    expect(result.result.totals.lossDeduction).toBe(3000)
    expect(result.result.grossIncome).toBe(47000)
  })

  it('applies the 20% qualified business income deduction below the threshold', () => {
    const result = calculateReturn(ret({
      incomeItems: [{ type: 'schedule-c', grossReceipts: 40000, expenses: 0, confirmed: true }],
    }))
    expect(result.result.selfEmployment.deductibleHalf).toBe(2826)
    expect(result.result.qbi.amount).toBe(4285)
    expect(result.result.taxableIncome).toBe(17139)
  })

  it('does not invent a QBI deduction above the threshold', () => {
    const result = calculateReturn(ret({
      incomeItems: [{ type: 'schedule-c', grossReceipts: 250000, expenses: 0, confirmed: true }],
    }))
    expect(result.result.qbi.amount).toBe(0)
    expect(result.result.limitations.join(' ')).toMatch(/was not applied/i)
  })

  it('blocks collectibles instead of rating them incorrectly', () => {
    const result = calculateReturn(ret({
      incomeItems: [{ type: 'capital-gain', proceeds: 5000, basis: 1000, term: 'long', collectible: true, confirmed: true }],
    }))
    expect(result.result.blockers.join(' ')).toMatch(/28%/i)
  })

  it('propagates Schedule C profit to Schedule 1 and Schedule SE', () => {
    const result = calculateReturn(ret({
      incomeItems: [{ type: 'schedule-c', grossReceipts: 10000, expenses: 2500, confirmed: true }],
    }))
    const profit = result.result.forms.scheduleC.lines.find((line) => line.id === 'profit').amount
    const schedule1 = result.result.forms.schedule1.lines.find((line) => line.id === 'business').amount
    const schedule2 = result.result.forms.schedule2.lines.find((line) => line.id === 'se').amount
    expect(profit).toBe(7500)
    expect(schedule1).toBe(profit)
    expect(schedule2).toBe(result.result.selfEmployment.tax)
    expect(result.result.forms.notice).toMatch(/not IRS forms/i)
  })
})

describe('state calculations', () => {
  it('calculates a full-year Illinois return at 4.95%', () => {
    const result = calculateReturn(ret({
      address: { state: 'IL', residency: 'full-year' },
      stateReturn: { prepare: true, additions: 0, subtractions: 0, acknowledgeFederalOnly: false },
      incomeItems: [{ type: 'w2', wages: 50000, federalWithholding: 0, stateWithholding: 1000, confirmed: true }],
    }))
    expect(result.result.state.prepared).toBe(true)
    expect(result.result.state.tax).toBe(2334)
    expect(result.result.state.refund).toBe(0)
    expect(result.result.state.amountDue).toBe(1334)
  })

  it('calculates a full-year California return from the rate schedule', () => {
    const result = calculateReturn(ret({
      address: { state: 'CA', residency: 'full-year' },
      stateReturn: { prepare: true, additions: 0, subtractions: 0, acknowledgeFederalOnly: false },
      incomeItems: [{ type: 'w2', wages: 70000, federalWithholding: 0, stateWithholding: 0, confirmed: true }],
    }))
    expect(result.result.state.tax).toBe(2375)
    expect(result.result.state.verification).toBe('partial')
  })

  it('does not calculate an unsupported state unless the user limits the return to federal', () => {
    const blocked = calculateReturn(ret({
      address: { state: 'TX', residency: 'full-year' },
      stateReturn: { acknowledgeFederalOnly: false },
    }))
    expect(blocked.result.state.prepared).toBe(false)
    expect(blocked.result.blockers.length).toBeGreaterThan(0)
  })
})
