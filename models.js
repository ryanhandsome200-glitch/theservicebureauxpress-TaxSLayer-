export const WIZARD_STEPS = [
  { id: 'year', label: 'Tax year' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'taxpayer', label: 'You' },
  { id: 'spouse', label: 'Spouse' },
  { id: 'address', label: 'Address' },
  { id: 'status', label: 'Filing status' },
  { id: 'dependents', label: 'Dependents' },
  { id: 'income', label: 'Income' },
  { id: 'adjustments', label: 'Adjustments' },
  { id: 'deductions', label: 'Deductions' },
  { id: 'credits', label: 'Credits' },
  { id: 'taxes', label: 'Other taxes' },
  { id: 'payments', label: 'Payments' },
  { id: 'federal', label: 'Federal review' },
  { id: 'state', label: 'State' },
  { id: 'validate', label: 'Validation' },
  { id: 'calculations', label: 'Calculations' },
  { id: 'fees', label: 'Fees' },
  { id: 'signature', label: 'Authorization' },
  { id: 'submit', label: 'Submit' },
  { id: 'result', label: 'Result' },
  { id: 'track', label: 'Status' },
]

export const INCOME_TYPES = [
  { id: 'w2', label: 'W-2 wages' },
  { id: '1099-nec', label: '1099-NEC' },
  { id: '1099-misc', label: '1099-MISC' },
  { id: '1099-int', label: '1099-INT' },
  { id: '1099-div', label: '1099-DIV' },
  { id: '1099-r', label: '1099-R' },
  { id: 'schedule-c', label: 'Business income' },
  { id: 'schedule-e', label: 'Rental income' },
  { id: 'capital-gain', label: 'Capital gain or loss' },
  { id: 'unemployment', label: 'Unemployment compensation' },
  { id: 'social-security', label: 'Social Security benefits' },
  { id: 'other', label: 'Other income' },
]

export function createEmptyReturn(userId) {
  return {
    id: crypto.randomUUID(),
    userId,
    taxYear: 2025,
    status: 'draft',
    productId: '',
    step: 'year',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    married: false,
    taxpayer: emptyPerson(),
    spouse: emptyPerson(),
    address: { line1: '', city: '', state: '', postalCode: '', residency: 'full-year' },
    filingStatus: '',
    dependents: [],
    incomeItems: [],
    adjustments: { educatorTaxpayer: 0, educatorSpouse: 0, studentLoanInterest: 0, iraDeduction: 0 },
    deductions: {
      choice: 'larger', medical: 0, stateLocalIncomeOrSales: 0, realEstate: 0,
      personalProperty: 0, mortgageInterest: 0, charityCash: 0, charityNoncash: 0, spouseMustItemize: false,
    },
    credits: {
      claimCtc: false, ssnAttested: false, claimEitc: false, separatedSpouseEitc: false,
      claimEducation: false, educationType: 'aotc', educationExpenses: 0, educationHalfTime: false, educationYearsClaimed: 0,
    },
    payments: { estimatedFederal: 0, estimatedState: 0 },
    stateReturn: { prepare: true, additions: 0, subtractions: 0, acknowledgeFederalOnly: false },
    eligibility: { nonresidentAlien: false, estateOrTrust: false, foreignEarnedIncome: false, digitalAssets: false, hohQualifyingPerson: false, spouseDeathYear: '' },
    signature: { accepted: false, name: '', date: '', authorization: false },
    feesAcknowledged: false,
    documents: [],
    filing: null,
    payment: null,
    activity: [],
    versions: [],
  }
}

export function emptyPerson() {
  return { firstName: '', lastName: '', dateOfBirth: '', occupation: '', blind: false, claimedAsDependent: false, tinLast4: '' }
}

export function createIncomeItem(type) {
  return {
    id: crypto.randomUUID(),
    type,
    payerName: '',
    description: '',
    wages: 0,
    federalWithholding: 0,
    ssWages: '',
    medicareWages: '',
    stateWithholding: 0,
    stateCode: '',
    additionalMedicareWithheld: 0,
    interest: 0,
    taxExemptInterest: 0,
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    compensation: 0,
    expenses: 0,
    grossReceipts: 0,
    rents: 0,
    otherIncome: 0,
    taxableAmount: 0,
    amount: 0,
    proceeds: 0,
    basis: 0,
    term: 'short',
    collectible: false,
    earlyDistribution: 'no',
    noneTaxable: false,
    treatAsBusiness: false,
    qbi: false,
    confirmed: true,
    source: 'manual',
  }
}

export function createDependent() {
  return {
    id: crypto.randomUUID(),
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    relationship: '',
    monthsLived: 12,
    student: false,
    disabled: false,
    qualifyingChild: true,
  }
}

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

export function serializeReturn(record) {
  const copy = sanitize(record)
  delete copy.calculation
  delete copy.validation
  copy.documents = (copy.documents || []).map((document) => {
    const { content: _content, bytes: _bytes, dataUrl: _dataUrl, ...rest } = document
    return { ...rest, storage: 'metadata-only' }
  })
  return copy
}

export function deserializeReturn(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Return payload is not an object.')
  }
  const clean = sanitize(payload)
  if (Number(clean.taxYear) !== 2025) throw new Error('Only tax year 2025 can be loaded.')
  const base = createEmptyReturn(clean.userId || '')
  return {
    ...base,
    ...clean,
    taxpayer: { ...base.taxpayer, ...(clean.taxpayer || {}) },
    spouse: { ...base.spouse, ...(clean.spouse || {}) },
    address: { ...base.address, ...(clean.address || {}) },
    adjustments: { ...base.adjustments, ...(clean.adjustments || {}) },
    deductions: { ...base.deductions, ...(clean.deductions || {}) },
    credits: { ...base.credits, ...(clean.credits || {}) },
    payments: { ...base.payments, ...(clean.payments || {}) },
    stateReturn: { ...base.stateReturn, ...(clean.stateReturn || {}) },
    eligibility: { ...base.eligibility, ...(clean.eligibility || {}) },
    signature: { ...base.signature, ...(clean.signature || {}) },
    dependents: Array.isArray(clean.dependents) ? clean.dependents : [],
    incomeItems: Array.isArray(clean.incomeItems) ? clean.incomeItems : [],
    documents: Array.isArray(clean.documents) ? clean.documents.map((document) => {
      const { content: _content, bytes: _bytes, dataUrl: _dataUrl, ...rest } = document || {}
      return rest
    }) : [],
    id: String(clean.id || base.id),
    userId: String(clean.userId || ''),
  }
}

function sanitize(value, depth = 0) {
  if (depth > 8) throw new Error('Return payload is too deep.')
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, entry] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) throw new Error('Unsafe key in return payload.')
      out[key] = sanitize(entry, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 4000) throw new Error('A text field is too long.')
  return value
}
