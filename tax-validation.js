import { productFits, quoteFees, recommendedProduct } from './tax-rules.js'
import { WIZARD_STEPS } from './models.js'

export function validateReturn(record, calculation) {
  const findings = []
  WIZARD_STEPS.forEach((step) => findings.push(...validateStep(record, step.id, calculation)))
  const unique = dedupe(findings)
  const errors = unique.filter((item) => item.severity === 'error')
  const warnings = unique.filter((item) => item.severity === 'warning')
  const info = unique.filter((item) => item.severity === 'info')
  return { errors, warnings, info, canSubmit: errors.length === 0 && Boolean(record.signature?.accepted) && Boolean(record.feesAcknowledged) }
}

export function validateStep(record, stepId, calculation) {
  const findings = []
  const error = (code, message, field) => findings.push({ severity: 'error', code, message, step: stepId, field })
  const warning = (code, message, field) => findings.push({ severity: 'warning', code, message, step: stepId, field })
  const info = (code, message, field) => findings.push({ severity: 'info', code, message, step: stepId, field })

  if (stepId === 'year' && Number(record.taxYear) !== 2025) error('YEAR', 'Tax year 2025 is the only year with rules loaded.', 'taxYear')
  if (stepId === 'eligibility') {
    if (record.eligibility?.nonresidentAlien) error('NRA', 'Form 1040-NR is not supported.', 'nonresidentAlien')
    if (record.eligibility?.estateOrTrust) error('ESTATE', 'Estate and trust returns are not supported.', 'estateOrTrust')
    if (record.eligibility?.foreignEarnedIncome) error('FOREIGN', 'The foreign earned income exclusion is not calculated.', 'foreignEarnedIncome')
    if (record.eligibility?.digitalAssets) warning('DIGITAL', 'Digital-asset activity was indicated. Enter each taxable sale as a capital transaction. This application does not import an exchange account.', 'digitalAssets')
  }
  if (stepId === 'taxpayer') {
    if (!text(record.taxpayer?.firstName)) error('NAME', 'Enter your first name.', 'firstName')
    if (!text(record.taxpayer?.lastName)) error('NAME', 'Enter your last name.', 'lastName')
    if (!iso(record.taxpayer?.dateOfBirth)) error('DOB', 'Enter your date of birth.', 'dateOfBirth')
    if (record.taxpayer?.tinLast4 && !/^\d{4}$/.test(record.taxpayer.tinLast4)) error('TIN', 'Enter only the last four digits, or leave the field blank.', 'tinLast4')
  }
  if (stepId === 'spouse') {
    if (record.married) {
      if (!text(record.spouse?.firstName)) error('SPOUSE', 'Enter your spouse’s first name.', 'spouseFirstName')
      if (!text(record.spouse?.lastName)) error('SPOUSE', 'Enter your spouse’s last name.', 'spouseLastName')
      if (!iso(record.spouse?.dateOfBirth)) error('SPOUSE', 'Enter your spouse’s date of birth.', 'spouseDateOfBirth')
    }
  }
  if (stepId === 'address') {
    if (!text(record.address?.line1)) error('ADDRESS', 'Enter a mailing street address.', 'line1')
    if (!text(record.address?.city)) error('ADDRESS', 'Enter a city.', 'city')
    if (!/^[A-Za-z]{2}$/.test(record.address?.state || '')) error('ADDRESS', 'Enter a two-letter state code.', 'state')
    if (!/^\d{5}(-\d{4})?$/.test(record.address?.postalCode || '')) error('ADDRESS', 'Enter a 5-digit ZIP code.', 'postalCode')
    if (!['full-year', 'part-year', 'nonresident'].includes(record.address?.residency)) error('ADDRESS', 'Choose a residency status.', 'residency')
  }
  if (stepId === 'status') {
    if (!record.filingStatus) error('STATUS', 'Choose a filing status.', 'filingStatus')
    if (record.married && record.filingStatus === 'single') error('STATUS', 'Single filing status conflicts with the spouse answers.', 'filingStatus')
    if (!record.married && ['mfj', 'mfs'].includes(record.filingStatus)) error('STATUS', 'Married filing statuses require spouse information.', 'filingStatus')
    if (record.filingStatus === 'hoh' && !(record.dependents || []).length && !record.eligibility?.hohQualifyingPerson) {
      error('STATUS', 'Head of household needs a qualifying person.', 'filingStatus')
    }
    if (record.filingStatus === 'qss' && (!record.eligibility?.spouseDeathYear || !(record.dependents || []).length)) {
      error('STATUS', 'Qualifying surviving spouse needs the year of death and a dependent child.', 'spouseDeathYear')
    }
  }
  if (stepId === 'dependents') {
    (record.dependents || []).forEach((dependent, index) => {
      if (!text(dependent.firstName) || !text(dependent.lastName)) error('DEPENDENT', `Dependent ${index + 1} needs a first and last name.`, `dependent-${index}`)
      if (!iso(dependent.dateOfBirth)) error('DEPENDENT', `Dependent ${index + 1} needs a date of birth.`, `dependent-${index}-dob`)
      if (!text(dependent.relationship)) error('DEPENDENT', `Dependent ${index + 1} needs a relationship.`, `dependent-${index}-relationship`)
    })
  }
  if (stepId === 'income') {
    const seen = new Map()
    ;(record.incomeItems || []).forEach((item, index) => {
      if (item.confirmed === false) error('CONFIRM', `Income item ${index + 1} still needs your confirmation.`, `income-${index}`)
      const key = `${item.type}|${(item.payerName || '').toLowerCase()}|${primaryAmount(item)}`
      if (item.payerName && seen.has(key)) warning('DUPLICATE', `${item.payerName} looks like a duplicate ${item.type} entry.`, `income-${index}`)
      seen.set(key, true)
      if (item.type === 'social-security' && !item.noneTaxable && item.taxableAmount === '') {
        error('SS', 'Enter the taxable Social Security amount or mark that none of it is taxable. This application does not invent the taxable portion.', `income-${index}`)
      }
    })
    if (!(record.incomeItems || []).length) info('INCOME', 'No income has been entered yet.', 'income')
  }
  if (stepId === 'credits') {
    if (record.credits?.claimCtc && !record.credits?.ssnAttested) error('CTC', 'The child tax credit was not applied. Attest that the required Social Security numbers will be validated by a filing provider, or do not claim the credit.', 'ssnAttested')
    if ((record.dependents || []).length && !record.credits?.claimCtc) info('CTC', 'You have dependents and have not claimed the child tax credit. Claim it only if you meet the tests.', 'claimCtc')
  }
  if (stepId === 'state' && calculation?.result?.state?.blockers?.length) {
    calculation.result.state.blockers.forEach((message) => error('STATE', message, 'state'))
  }
  if (stepId === 'fees') {
    if (!record.productId) error('PRODUCT', 'Choose a preparation option.', 'productId')
    else if (!productFits(record.productId, record)) error('PRODUCT', `${recommendedProduct(record)} is the lowest option that covers the forms on this return.`, 'productId')
    const quote = quoteFees(record.productId, Boolean(calculation?.result?.state?.prepared))
    if (record.productId && !quote) error('PRODUCT', 'The selected preparation option is not configured.', 'productId')
  }
  if (stepId === 'signature') {
    if (!record.signature?.authorization) error('SIGN', 'The authorization box is required before submission.', 'authorization')
    if (!text(record.signature?.name)) error('SIGN', 'Type your name as the authorization signature.', 'signatureName')
    const expected = `${record.taxpayer?.firstName || ''} ${record.taxpayer?.lastName || ''}`.trim().toLowerCase()
    if (text(record.signature?.name) && record.signature.name.trim().toLowerCase() !== expected) {
      error('SIGN', 'The signature name must match the taxpayer name on this return.', 'signatureName')
    }
  }
  if (stepId === 'submit') {
    if (calculation?.result?.blockers?.length) calculation.result.blockers.forEach((message) => error('BLOCK', message, 'submit'))
    if (!record.feesAcknowledged) error('FEES', 'Acknowledge the fee summary before submission.', 'fees')
    if (record.filing?.accepted) error('FILING', 'A return cannot be marked accepted in this application unless a configured provider says so.', 'submit')
  }
  if (['adjustments', 'deductions', 'payments'].includes(stepId)) {
    const bag = record[stepId === 'adjustments' ? 'adjustments' : stepId === 'deductions' ? 'deductions' : 'payments'] || {}
    Object.entries(bag).forEach(([key, value]) => {
      if (typeof value === 'number' && value < 0) error('NEGATIVE', `${key} cannot be negative.`, key)
    })
  }
  if (calculation?.result && ['validate', 'calculations', 'federal'].includes(stepId)) {
    calculation.result.limitations.forEach((message) => warning('LIMIT', message, 'calculation'))
  }
  return dedupe(findings)
}

export function completionRatio(record, calculation) {
  const required = WIZARD_STEPS.filter((step) => !['result', 'track'].includes(step.id))
  const done = required.filter((step) => validateStep(record, step.id, calculation).every((item) => item.severity !== 'error'))
  return { done: done.length, total: required.length, percent: Math.round((done.length / required.length) * 100) }
}

function dedupe(findings) {
  const seen = new Set()
  return findings.filter((item) => {
    const key = `${item.severity}|${item.code}|${item.message}|${item.field}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function iso(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function primaryAmount(item) {
  return item.wages ?? item.compensation ?? item.interest ?? item.ordinaryDividends ?? item.taxableAmount ?? item.amount ?? item.grossReceipts ?? item.proceeds ?? ''
}
