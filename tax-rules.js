import { dollarsToCents } from './format.js'

const year2025 = {
  taxYear: 2025,
  version: 'ty2025-rp2024-40-rp2025-32',
  lastReviewed: '2026-10-20',
  overallStatus: 'partial',
  summary: '2025 federal rate schedules and the OBBBA standard deduction are loaded. The engine covers common individual items and full-year California and Illinois calculations. It is not a complete filing system for every form.',
  sources: [
    { id: 'rp-2024-40', title: 'Rev. Proc. 2024-40', url: 'https://www.irs.gov/pub/irs-drop/rp-24-40.pdf' },
    { id: 'rp-2025-32', title: 'Rev. Proc. 2025-32', url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf' },
    { id: 'irs-brackets', title: 'IRS 2025 federal income tax rates and brackets', url: 'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets' },
    { id: 'irs-ctc', title: 'IRS Child Tax Credit', url: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit' },
    { id: 'irs-8812', title: '2025 Instructions for Schedule 8812', url: 'https://www.irs.gov/pub/irs-pdf/i1040s8.pdf' },
    { id: 'irs-eitc', title: 'IRS EITC tables, tax year 2025', url: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-and-earned-income-tax-credit-eitc-tables' },
    { id: 'irs-schedule-a', title: '2025 Instructions for Schedule A', url: 'https://www.irs.gov/instructions/i1040sca' },
    { id: 'irs-schedule-se', title: '2025 Instructions for Schedule SE', url: 'https://www.irs.gov/instructions/i1040sse' },
    { id: 'ssa-2025', title: 'SSA 2025 wage base', url: 'https://www.ssa.gov/news/en/cola/factsheets/2025.html' },
    { id: 'ftb-rates', title: '2025 California tax rate schedules', url: 'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf' },
    { id: 'ftb-540', title: '2025 California Form 540 booklet', url: 'https://www.ftb.ca.gov/forms/2025/2025-540-booklet.html' },
    { id: 'ftb-index', title: 'FTB 2025 indexing announcement', url: 'https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/2025/10.html' },
    { id: 'il-1040', title: '2025 IL-1040 instructions', url: 'https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-instr.pdf' },
  ],
  verification: {
    brackets: 'verified',
    standardDeduction: 'verified',
    additionalStandardDeduction: 'verified',
    eitcParameters: 'verified',
    childTaxCredit: 'verified',
    saltCap: 'verified',
    studentLoanInterest: 'verified',
    educatorExpense: 'verified',
    qbiThreshold: 'verified',
    selfEmploymentTax: 'verified',
    capitalGainThresholds: 'verified',
    educationCredit: 'statutory-confirm-form-8863',
    additionalMedicare: 'partial',
    netInvestmentIncomeTax: 'partial',
    californiaRates: 'verified-schedule',
    californiaConformity: 'partial',
    illinoisRate: 'verified',
    illinoisDependentExemption: 'partial',
  },
  standardDeduction: { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500 },
  additionalStandardDeduction: { unmarried: 2000, married: 1600 },
  dependentMinimum: 1350,
  dependentEarnedAdd: 450,
  socialSecurityWageBase: 176100,
  excessBusinessLoss: { joint: 626000, other: 313000 },
  capitalLossLimit: { mfs: 1500, other: 3000 },
  brackets: {
    mfj: [
      { over: 0, upTo: 23850, base: 0, rate: 0.1 },
      { over: 23850, upTo: 96950, base: 2385, rate: 0.12 },
      { over: 96950, upTo: 206700, base: 11157, rate: 0.22 },
      { over: 206700, upTo: 394600, base: 35302, rate: 0.24 },
      { over: 394600, upTo: 501050, base: 80398, rate: 0.32 },
      { over: 501050, upTo: 751600, base: 114462, rate: 0.35 },
      { over: 751600, upTo: null, base: 202154.5, rate: 0.37 },
    ],
    hoh: [
      { over: 0, upTo: 17000, base: 0, rate: 0.1 },
      { over: 17000, upTo: 64850, base: 1700, rate: 0.12 },
      { over: 64850, upTo: 103350, base: 7442, rate: 0.22 },
      { over: 103350, upTo: 197300, base: 15912, rate: 0.24 },
      { over: 197300, upTo: 250500, base: 38460, rate: 0.32 },
      { over: 250500, upTo: 626350, base: 55484, rate: 0.35 },
      { over: 626350, upTo: null, base: 187031.5, rate: 0.37 },
    ],
    single: [
      { over: 0, upTo: 11925, base: 0, rate: 0.1 },
      { over: 11925, upTo: 48475, base: 1192.5, rate: 0.12 },
      { over: 48475, upTo: 103350, base: 5578.5, rate: 0.22 },
      { over: 103350, upTo: 197300, base: 17651, rate: 0.24 },
      { over: 197300, upTo: 250525, base: 40199, rate: 0.32 },
      { over: 250525, upTo: 626350, base: 57231, rate: 0.35 },
      { over: 626350, upTo: null, base: 188769.75, rate: 0.37 },
    ],
    mfs: [
      { over: 0, upTo: 11925, base: 0, rate: 0.1 },
      { over: 11925, upTo: 48475, base: 1192.5, rate: 0.12 },
      { over: 48475, upTo: 103350, base: 5578.5, rate: 0.22 },
      { over: 103350, upTo: 197300, base: 17651, rate: 0.24 },
      { over: 197300, upTo: 250525, base: 40199, rate: 0.32 },
      { over: 250525, upTo: 375800, base: 57231, rate: 0.35 },
      { over: 375800, upTo: null, base: 101077.25, rate: 0.37 },
    ],
  },
  capitalGains: {
    mfj: { zero: 96700, fifteen: 600050 },
    qss: { zero: 96700, fifteen: 600050 },
    mfs: { zero: 48350, fifteen: 300000 },
    hoh: { zero: 64750, fifteen: 566700 },
    single: { zero: 48350, fifteen: 533400 },
  },
  amtExemption: { mfj: 137000, qss: 137000, mfs: 68500, single: 88100, hoh: 88100 },
  qbiThreshold: { mfj: 394600, mfs: 197300, single: 197300, hoh: 197300, qss: 197300 },
  studentLoan: {
    maximum: 2500,
    joint: { start: 170000, end: 200000 },
    other: { start: 85000, end: 100000 },
  },
  educatorExpenseCap: 300,
  iraLimit: { base: 7000, catchUp: 1000 },
  eitc: {
    investmentLimit: 11950,
    bands: {
      0: { earnedIncomeAmount: 8490, maxCredit: 649, creditRate: 0.0765, phaseRate: 0.0765, phaseoutJoint: 17730, phaseoutOther: 10620, completedJoint: 26214, completedOther: 19104 },
      1: { earnedIncomeAmount: 12730, maxCredit: 4328, creditRate: 0.34, phaseRate: 0.1598, phaseoutJoint: 30470, phaseoutOther: 23350, completedJoint: 57554, completedOther: 50434 },
      2: { earnedIncomeAmount: 17880, maxCredit: 7152, creditRate: 0.4, phaseRate: 0.2106, phaseoutJoint: 30470, phaseoutOther: 23350, completedJoint: 64430, completedOther: 57310 },
      3: { earnedIncomeAmount: 17880, maxCredit: 8046, creditRate: 0.45, phaseRate: 0.2106, phaseoutJoint: 30470, phaseoutOther: 23350, completedJoint: 68675, completedOther: 61555 },
    },
  },
  ctc: { perChild: 2200, actcPerChild: 1700, actcEarnedFloor: 2500, phaseoutJoint: 400000, phaseoutOther: 200000 },
  education: {
    aotcMax: 2500,
    llcMax: 2000,
    llcExpenseCap: 10000,
    phaseoutJoint: { start: 160000, end: 180000 },
    phaseoutOther: { start: 80000, end: 90000 },
  },
  salt: { base: 40000, floor: 10000, threshold: 500000, thresholdMfs: 250000, reductionRate: 0.3 },
  charity: { cashAgi: 0.6, noncashAgi: 0.3 },
  medicalFloor: 0.075,
  states: {
    CA: {
      name: 'California',
      agency: 'Franchise Tax Board',
      verification: 'partial',
      standardDeduction: { single: 5706, mfs: 5706, mfj: 11412, hoh: 11412, qss: 11412 },
      dependentStandardMinimum: 1350,
      exemptionCredit: { single: 153, mfs: 153, hoh: 153, mfj: 306, qss: 306, seniorEach: 153, blindEach: 153, dependent: 475 },
      mentalHealthThreshold: 1000000,
      mentalHealthRate: 0.01,
      brackets: {
        single: caScheduleX(),
        mfs: caScheduleX(),
        mfj: caScheduleY(),
        qss: caScheduleY(),
        hoh: caScheduleZ(),
      },
    },
    IL: {
      name: 'Illinois',
      agency: 'Illinois Department of Revenue',
      verification: 'partial',
      rate: 0.0495,
      personalExemption: 2850,
      jointExemption: 5700,
      seniorOrBlind: 1000,
      dependentExemption: 2850,
      agiLimitJoint: 500000,
      agiLimitOther: 250000,
    },
  },
}

function caScheduleX() {
  return [
    { over: 0, upTo: 11079, base: 0, rate: 0.01 },
    { over: 11079, upTo: 26264, base: 110.79, rate: 0.02 },
    { over: 26264, upTo: 41452, base: 414.49, rate: 0.04 },
    { over: 41452, upTo: 57542, base: 1022.01, rate: 0.06 },
    { over: 57542, upTo: 72724, base: 1987.41, rate: 0.08 },
    { over: 72724, upTo: 371479, base: 3201.97, rate: 0.093 },
    { over: 371479, upTo: 445771, base: 30986.19, rate: 0.103 },
    { over: 445771, upTo: 742953, base: 38638.27, rate: 0.113 },
    { over: 742953, upTo: null, base: 72219.84, rate: 0.123 },
  ]
}

function caScheduleY() {
  return [
    { over: 0, upTo: 22158, base: 0, rate: 0.01 },
    { over: 22158, upTo: 52528, base: 221.58, rate: 0.02 },
    { over: 52528, upTo: 82904, base: 828.98, rate: 0.04 },
    { over: 82904, upTo: 115084, base: 2044.02, rate: 0.06 },
    { over: 115084, upTo: 145448, base: 3974.82, rate: 0.08 },
    { over: 145448, upTo: 742958, base: 6403.94, rate: 0.093 },
    { over: 742958, upTo: 891542, base: 61972.37, rate: 0.103 },
    { over: 891542, upTo: 1485906, base: 77276.52, rate: 0.113 },
    { over: 1485906, upTo: null, base: 144439.65, rate: 0.123 },
  ]
}

function caScheduleZ() {
  return [
    { over: 0, upTo: 22173, base: 0, rate: 0.01 },
    { over: 22173, upTo: 52530, base: 221.73, rate: 0.02 },
    { over: 52530, upTo: 67716, base: 828.87, rate: 0.04 },
    { over: 67716, upTo: 83805, base: 1436.31, rate: 0.06 },
    { over: 83805, upTo: 98990, base: 2401.65, rate: 0.08 },
    { over: 98990, upTo: 505208, base: 3616.45, rate: 0.093 },
    { over: 505208, upTo: 606251, base: 41394.72, rate: 0.103 },
    { over: 606251, upTo: 1010417, base: 51802.15, rate: 0.113 },
    { over: 1010417, upTo: null, base: 97472.91, rate: 0.123 },
  ]
}

const RULES = { 2025: year2025 }

export const PRODUCTS = {
  essential: {
    id: 'essential',
    name: 'Essential',
    federalFee: 0,
    stateFee: 0,
    summary: 'No-fee federal preparation for a straightforward return, including one supported state when the return stays inside the Essential limits.',
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    federalFee: 19,
    stateFee: 15,
    summary: 'Wages plus interest and dividends, when the return does not need dependents, itemizing, or business forms.',
  },
  household: {
    id: 'household',
    name: 'Household',
    federalFee: 39,
    stateFee: 29,
    summary: 'Dependents, itemized deductions, investments, and retirement distributions.',
  },
  selfEmployed: {
    id: 'selfEmployed',
    name: 'Self-Employed',
    federalFee: 69,
    stateFee: 29,
    summary: 'Business income, 1099-NEC, and self-employment tax, with the Household scope included.',
  },
}

export const FORM_CATALOG = [
  { id: '1040', name: 'Form 1040', status: 'supported', note: 'Core wage, investment, business, deduction, credit, and payment lines for situations this engine calculates.' },
  { id: 'schedule-1', name: 'Schedule 1', status: 'supported', note: 'Additional income and the adjustments calculated here.' },
  { id: 'schedule-2', name: 'Schedule 2', status: 'supported', note: 'Self-employment tax, simplified additional Medicare tax, and simplified net investment income tax.' },
  { id: 'schedule-3', name: 'Schedule 3', status: 'supported', note: 'Nonrefundable education credit when a user claims it.' },
  { id: 'schedule-a', name: 'Schedule A', status: 'supported', note: 'Medical floor, 2025 SALT cap, mortgage interest as entered, and a simplified charitable limit.' },
  { id: 'schedule-b', name: 'Schedule B', status: 'supported', note: 'Interest and ordinary dividends. Required in the review when the total is over $1,500.' },
  { id: 'schedule-c', name: 'Schedule C', status: 'supported', note: 'Gross receipts minus expenses entered by the user. Depreciation, vehicle tables, and the home-office deduction are not calculated.' },
  { id: 'schedule-d', name: 'Schedule D', status: 'supported', note: 'Short-term and long-term netting and the capital-loss limit. Wash sales are not detected.' },
  { id: 'form-8949', name: 'Form 8949', status: 'supported', note: 'One summary row for each entered sale. Basis-reporting codes are not imported from a broker.' },
  { id: 'schedule-e', name: 'Schedule E', status: 'supported', note: 'Rental receipts minus expenses. A rental loss is not deducted because the passive-activity allowance is not calculated.' },
  { id: 'schedule-se', name: 'Schedule SE', status: 'supported', note: '2025 Social Security wage base and Medicare portions.' },
  { id: 'schedule-8812', name: 'Schedule 8812', status: 'supported', note: 'Child tax credit and additional child tax credit when the user claims qualifying children.' },
  { id: 'form-8863', name: 'Form 8863', status: 'partial', note: 'One student. Amounts follow the statutory American opportunity and lifetime learning formulas and should be confirmed on the 2025 form.' },
  { id: 'form-2441', name: 'Form 2441', status: 'unsupported', note: 'The child and dependent care credit is not calculated.' },
  { id: 'form-8880', name: 'Form 8880', status: 'unsupported', note: 'The retirement savings credit is not calculated.' },
  { id: 'form-8962', name: 'Form 8962', status: 'unsupported', note: 'The premium tax credit is not calculated.' },
  { id: 'form-6251', name: 'Form 6251', status: 'unsupported', note: 'Alternative minimum tax is not calculated. Returns over the exemption are flagged.' },
  { id: 'ca-540', name: 'California Form 540', status: 'partial', note: 'Full-year residents. Rate schedule, standard or limited itemized deduction, exemption credits, and the Behavioral Health Services Tax. Full Schedule CA conformity is not automatic.' },
  { id: 'il-1040', name: 'Illinois Form IL-1040', status: 'partial', note: 'Full-year residents. The 4.95% rate, exemption allowance, and a Social Security subtraction. Other Schedule M items are entered by the user or omitted.' },
]

export function getTaxYearRules(year) {
  return RULES[Number(year)] || null
}

export function listTaxYears() {
  return Object.values(RULES).map((rules) => ({
    taxYear: rules.taxYear,
    version: rules.version,
    lastReviewed: rules.lastReviewed,
    overallStatus: rules.overallStatus,
    summary: rules.summary,
  }))
}

export function bracketTaxCents(incomeCents, brackets) {
  const income = Math.max(0, Math.round(incomeCents))
  if (income === 0) return 0
  for (const bracket of brackets) {
    const over = dollarsToCents(bracket.over)
    const upTo = bracket.upTo == null ? null : dollarsToCents(bracket.upTo)
    const aboveFloor = bracket.over === 0 ? income >= over : income > over
    if (aboveFloor && (upTo == null || income <= upTo)) {
      const excess = income - over
      const variable = Math.round(excess * Math.round(bracket.rate * 10000) / 10000)
      return dollarsToCents(bracket.base) + variable
    }
  }
  throw new Error('Taxable income did not match a bracket.')
}

export function quoteFees(productId, statePrepared) {
  const product = PRODUCTS[productId]
  if (!product) return null
  const stateFee = statePrepared ? product.stateFee : 0
  return {
    productId,
    name: product.name,
    federalFee: product.federalFee,
    stateFee,
    total: roundCurrency(product.federalFee + stateFee),
  }
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100
}

export function recommendedProduct(record) {
  const items = record?.incomeItems || []
  const types = new Set(items.map((item) => item.type))
  const selfEmployed = ['1099-nec', 'schedule-c'].some((type) => types.has(type))
    || items.some((item) => item.type === '1099-misc' && Number(item.otherIncome) > 0 && item.treatAsBusiness)
  if (selfEmployed) return 'selfEmployed'
  const household = (record?.dependents || []).length > 0
    || record?.deductions?.choice === 'itemized'
    || record?.deductions?.spouseMustItemize
    || ['1099-r', '1099-misc', 'schedule-e', 'capital-gain'].some((type) => types.has(type))
    || !['single', 'mfj', ''].includes(record?.filingStatus || '')
  if (household) return 'household'
  if (['1099-int', '1099-div'].some((type) => types.has(type))) return 'standard'
  return 'essential'
}

export function productFits(productId, record) {
  const needed = recommendedProduct(record)
  const rank = { essential: 0, standard: 1, household: 2, selfEmployed: 3 }
  return rank[productId] >= rank[needed]
}
