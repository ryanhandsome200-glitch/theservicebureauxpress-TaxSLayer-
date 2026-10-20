import { FORM_CATALOG } from './tax-rules.js'

export function buildFormSet(record, result) {
  const totals = result.totals || {}
  const scheduleC = {
    id: 'schedule-c',
    name: 'Schedule C',
    supported: true,
    lines: [
      { id: 'gross', label: 'Gross receipts', amount: businessGross(record) },
      { id: 'expenses', label: 'Expenses entered', amount: businessExpenses(record) },
      { id: 'profit', label: 'Net profit or loss', amount: round(totals.businessProfit) },
    ],
  }
  const scheduleSE = {
    id: 'schedule-se',
    name: 'Schedule SE',
    supported: true,
    lines: [
      { id: 'net', label: 'Net profit subject to self-employment tax', amount: Math.max(0, round(totals.businessProfit)) },
      { id: 'base', label: 'Net earnings (92.35%)', amount: result.selfEmployment?.base || 0 },
      { id: 'tax', label: 'Self-employment tax', amount: result.selfEmployment?.tax || 0 },
      { id: 'deduction', label: 'Deductible half of self-employment tax', amount: result.selfEmployment?.deductibleHalf || 0 },
    ],
  }
  const schedule1 = {
    id: 'schedule-1',
    name: 'Schedule 1',
    supported: true,
    lines: [
      { id: 'business', label: 'Business income or loss', amount: round(totals.businessProfit) },
      { id: 'rental', label: 'Rental real estate income allowed', amount: round(totals.rentalProfit) },
      { id: 'unemployment', label: 'Unemployment compensation', amount: round(totals.unemployment) },
      { id: 'educator', label: 'Educator expenses', amount: result.adjustments?.educator || 0 },
      { id: 'se-deduction', label: 'Deductible part of self-employment tax', amount: result.selfEmployment?.deductibleHalf || 0 },
      { id: 'student-loan', label: 'Student loan interest deduction', amount: result.adjustments?.studentLoan || 0 },
    ],
  }
  const schedule2 = {
    id: 'schedule-2',
    name: 'Schedule 2',
    supported: true,
    lines: [
      { id: 'se', label: 'Self-employment tax', amount: result.selfEmployment?.tax || 0 },
      { id: 'medicare', label: 'Additional Medicare tax', amount: result.additionalMedicare?.tax || 0 },
      { id: 'niit', label: 'Net investment income tax', amount: result.niit?.tax || 0 },
      { id: 'early', label: 'Early distribution tax', amount: result.earlyWithdrawalPenalty || 0 },
    ],
  }
  const schedule3 = {
    id: 'schedule-3',
    name: 'Schedule 3',
    supported: true,
    lines: [
      { id: 'education', label: 'Nonrefundable education credit', amount: result.credits?.educationNonrefundable || 0 },
    ],
  }
  const scheduleA = {
    id: 'schedule-a',
    name: 'Schedule A',
    supported: result.deduction?.method === 'itemized',
    lines: [
      { id: 'medical', label: 'Medical expenses allowed', amount: result.deduction?.medical || 0 },
      { id: 'salt', label: 'State and local taxes allowed', amount: result.deduction?.salt || 0 },
      { id: 'mortgage', label: 'Mortgage interest entered', amount: number(record.deductions?.mortgageInterest) },
      { id: 'charity', label: 'Gifts to charity allowed', amount: result.deduction?.charity || 0 },
      { id: 'total', label: 'Itemized deduction total', amount: result.deduction?.itemized || 0 },
    ],
  }
  const interestAndDividends = round(totals.taxableInterest) + round(totals.ordinaryDividends)
  const scheduleB = {
    id: 'schedule-b',
    name: 'Schedule B',
    supported: true,
    required: interestAndDividends > 1500,
    lines: [
      { id: 'interest', label: 'Taxable interest', amount: round(totals.taxableInterest) },
      { id: 'dividends', label: 'Ordinary dividends', amount: round(totals.ordinaryDividends) },
    ],
  }
  const scheduleD = {
    id: 'schedule-d',
    name: 'Schedule D',
    supported: true,
    lines: [
      { id: 'short', label: 'Net short-term gain', amount: round(totals.shortTerm) },
      { id: 'long', label: 'Net long-term gain', amount: round(totals.longTerm) },
      { id: 'loss', label: 'Capital loss deduction', amount: round(totals.lossDeduction) },
      { id: 'carryover', label: 'Capital loss carryover not applied to another year', amount: round(totals.capitalCarryover) },
    ],
  }
  const form8949 = {
    id: 'form-8949',
    name: 'Form 8949',
    supported: true,
    rows: (record.incomeItems || []).filter((item) => item.type === 'capital-gain').map((item) => ({
      description: item.description || 'Sale',
      proceeds: number(item.proceeds),
      basis: number(item.basis),
      term: item.term || 'short',
      collectible: Boolean(item.collectible),
      gain: number(item.proceeds) - number(item.basis),
    })),
  }
  const scheduleE = {
    id: 'schedule-e',
    name: 'Schedule E',
    supported: true,
    lines: [
      { id: 'allowed', label: 'Rental income allowed', amount: round(totals.rentalProfit) },
      { id: 'suspended', label: 'Rental loss not deducted', amount: round(totals.rentalLossSuspended) },
    ],
  }
  const form1040 = {
    id: '1040',
    name: 'Form 1040',
    supported: true,
    unofficial: true,
    lines: [
      { id: 'wages', label: 'Wages', amount: round(totals.wages) },
      { id: 'interest', label: 'Taxable interest', amount: round(totals.taxableInterest) },
      { id: 'dividends', label: 'Ordinary dividends', amount: round(totals.ordinaryDividends) },
      { id: 'capital', label: 'Capital gain or allowed loss', amount: round(totals.shortTerm + totals.longTerm - totals.lossDeduction) },
      { id: 'additional-income', label: 'Additional income from Schedule 1', amount: round(totals.businessProfit + totals.rentalProfit + totals.unemployment + totals.otherIncome) },
      { id: 'gross', label: 'Total income', amount: result.grossIncome },
      { id: 'adjustments', label: 'Adjustments to income', amount: result.adjustments?.total || 0 },
      { id: 'agi', label: 'Adjusted gross income', amount: result.agi },
      { id: 'deduction', label: result.deduction?.method === 'itemized' ? 'Itemized deductions' : 'Standard deduction', amount: result.deduction?.amount || 0 },
      { id: 'qbi', label: 'Qualified business income deduction', amount: result.qbi?.amount || 0 },
      { id: 'taxable', label: 'Taxable income', amount: result.taxableIncome },
      { id: 'income-tax', label: 'Income tax', amount: result.incomeTax?.tax || 0 },
      { id: 'other-taxes', label: 'Other taxes from Schedule 2', amount: (result.selfEmployment?.tax || 0) + (result.additionalMedicare?.tax || 0) + (result.niit?.tax || 0) + (result.earlyWithdrawalPenalty || 0) },
      { id: 'ctc', label: 'Child tax credit', amount: result.credits?.childTaxCredit || 0 },
      { id: 'other-credits', label: 'Other nonrefundable credits', amount: result.credits?.educationNonrefundable || 0 },
      { id: 'withholding', label: 'Federal income tax withheld', amount: result.payments },
      { id: 'refundable', label: 'Refundable credits', amount: result.credits?.refundable || 0 },
      { id: 'refund', label: 'Estimated refund', amount: result.refund },
      { id: 'due', label: 'Estimated amount due', amount: result.amountDue },
    ],
  }
  return {
    unofficial: true,
    notice: 'These are unofficial worksheets. They are not IRS forms and they cannot be filed by themselves.',
    form1040,
    schedule1,
    schedule2,
    schedule3,
    scheduleA,
    scheduleB,
    scheduleC,
    scheduleD,
    form8949,
    scheduleE,
    scheduleSE,
    catalog: FORM_CATALOG,
  }
}

function businessGross(record) {
  return (record.incomeItems || []).reduce((sum, item) => {
    if (item.type === 'schedule-c') return sum + number(item.grossReceipts)
    if (item.type === '1099-nec') return sum + number(item.compensation)
    if (item.type === '1099-misc' && item.treatAsBusiness) return sum + number(item.otherIncome)
    return sum
  }, 0)
}

function businessExpenses(record) {
  return (record.incomeItems || []).reduce((sum, item) => {
    if (['schedule-c', '1099-nec'].includes(item.type) || (item.type === '1099-misc' && item.treatAsBusiness)) {
      return sum + number(item.expenses)
    }
    return sum
  }, 0)
}

function number(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round(value) {
  return Math.round(number(value))
}
