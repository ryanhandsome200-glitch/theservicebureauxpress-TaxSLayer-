import { applyRate, dollarsToCents, roundToDollars } from './format.js'
import { bracketTaxCents, getTaxYearRules } from './tax-rules.js'

export function calculateState(record, federal) {
  const rules = getTaxYearRules(federal.taxYear)
  const code = String(record.address?.state || '').toUpperCase()
  const residency = record.address?.residency || 'full-year'
  const stateInput = record.stateReturn || {}
  const acknowledgeFederalOnly = Boolean(stateInput.acknowledgeFederalOnly)
  const supported = rules?.states?.[code]
  const limitations = []
  const blockers = []

  if (!supported) {
    const message = code
      ? `${code} is not one of the states calculated in this version. Calculated states are California and Illinois, for full-year residents.`
      : 'Select a state of residence before a state return can be prepared.'
    if (!acknowledgeFederalOnly) blockers.push(message)
    return { prepared: false, code, limitations, blockers, message, tax: 0, refund: 0, amountDue: 0 }
  }

  if (residency !== 'full-year') {
    const message = `Part-year and nonresident ${supported.name} returns are not calculated.`
    if (!acknowledgeFederalOnly) blockers.push(message)
    else limitations.push(message)
    return { prepared: false, code, limitations, blockers, message, tax: 0, refund: 0, amountDue: 0 }
  }

  if (stateInput.prepare === false) {
    return {
      prepared: false,
      code,
      limitations: [`You chose to skip the ${supported.name} return in this application.`],
      blockers: [],
      message: 'State preparation was skipped.',
      tax: 0,
      refund: 0,
      amountDue: 0,
    }
  }

  const additions = numberOrZero(stateInput.additions)
  const subtractions = numberOrZero(stateInput.subtractions)
  const calculated = code === 'CA'
    ? calculateCalifornia(rules.states.CA, record, federal, additions, subtractions)
    : calculateIllinois(rules.states.IL, record, federal, additions, subtractions)

  const payments = roundToDollars(dollarsToCents(federal.stateWithholding + numberOrZero(record.payments?.estimatedState)))
  const balance = roundToDollars(dollarsToCents(payments - calculated.tax))
  return {
    prepared: true,
    code,
    name: supported.name,
    verification: supported.verification,
    limitations: calculated.limitations,
    blockers: calculated.blockers,
    lines: calculated.lines,
    tax: calculated.tax,
    payments,
    refund: balance > 0 ? balance : 0,
    amountDue: balance < 0 ? Math.abs(balance) : 0,
    message: `${supported.name} full-year estimate.`,
  }
}

function calculateCalifornia(rules, record, federal, additions, subtractions) {
  const limitations = [
    'California conformity adjustments are limited to the additions and subtractions you entered. Schedule CA is not fully automated.',
  ]
  const status = federal.filingStatus
  const agi = roundToDollars(dollarsToCents(federal.agi + additions - subtractions))
  const standard = californiaStandard(rules, status, federal)
  const itemized = californiaItemized(federal, agi)
  const forceItemized = Boolean(record.deductions?.spouseMustItemize)
  const useItemized = forceItemized || itemized.amount > standard
  const deduction = useItemized ? itemized.amount : standard
  if (useItemized) limitations.push('The California itemized estimate excludes state income tax and does not apply every California adjustment.')
  const taxable = Math.max(0, roundToDollars(dollarsToCents(agi - deduction)))
  const regularCents = bracketTaxCents(dollarsToCents(taxable), rules.brackets[status])
  const regular = roundToDollars(regularCents)
  const credits = californiaCredits(rules, status, federal)
  const taxAfterCredits = Math.max(0, regular - credits.total)
  let mentalHealth = 0
  if (taxable > rules.mentalHealthThreshold) {
    mentalHealth = roundToDollars(applyRate(dollarsToCents(taxable - rules.mentalHealthThreshold), rules.mentalHealthRate))
  }
  const tax = taxAfterCredits + mentalHealth
  return {
    limitations,
    blockers: [],
    tax,
    lines: [
      { id: 'ca-agi', label: 'California AGI estimate', amount: agi },
      { id: 'ca-deduction', label: useItemized ? 'California itemized estimate' : 'California standard deduction', amount: deduction },
      { id: 'ca-taxable', label: 'California taxable income estimate', amount: taxable },
      { id: 'ca-regular', label: 'California regular tax', amount: regular },
      { id: 'ca-credits', label: 'California exemption credits', amount: credits.total },
      { id: 'ca-mental', label: 'Behavioral Health Services Tax', amount: mentalHealth },
      { id: 'ca-tax', label: 'California tax estimate', amount: tax },
    ],
  }
}

function californiaStandard(rules, status, federal) {
  let base = rules.standardDeduction[status]
  if (federal.claimedAsDependent) {
    const earned = Math.max(0, federal.earnedIncome)
    base = Math.min(base, Math.max(rules.dependentStandardMinimum, earned))
  }
  return base
}

function californiaItemized(federal, agi) {
  const medical = Math.max(0, federal.medical - agi * rulesMedicalFloor())
  const amount = roundToDollars(dollarsToCents(
    medical + federal.realEstate + federal.personalProperty + federal.mortgage + federal.charity,
  ))
  return { amount }
}

function rulesMedicalFloor() {
  return 0.075
}

function californiaCredits(rules, status, federal) {
  const credits = rules.exemptionCredit
  let personal = 0
  if (!federal.claimedAsDependent) personal = credits[status]
  else if (status === 'mfj' && !federal.spouseClaimed) personal = credits.seniorEach
  let senior = federal.taxpayerAge65 ? credits.seniorEach : 0
  if (['mfj', 'mfs', 'qss'].includes(status) && federal.spouseAge65) senior += credits.seniorEach
  let blind = federal.taxpayerBlind ? credits.blindEach : 0
  if (['mfj', 'mfs'].includes(status) && federal.spouseBlind) blind += credits.blindEach
  const dependents = federal.dependentCount * credits.dependent
  return { total: personal + senior + blind + dependents }
}

function calculateIllinois(rules, record, federal, additions, subtractions) {
  const socialSecurity = Math.max(0, federal.taxableSocialSecurity)
  const baseIncome = Math.max(0, roundToDollars(dollarsToCents(federal.agi + additions - subtractions - socialSecurity)))
  const exemption = illinoisExemption(rules, federal.filingStatus, federal.agi, federal)
  const net = Math.max(0, baseIncome - exemption.amount)
  const tax = roundToDollars(applyRate(dollarsToCents(net), rules.rate))
  return {
    limitations: [
      'Illinois base income starts from federal AGI. Federally taxable Social Security was subtracted. Other Schedule M items are included only when you enter them.',
      'The dependent exemption uses the $2,850 personal exemption allowance. Confirm Schedule IL-E/EITC Step 2 before relying on an Illinois filing figure.',
    ],
    blockers: [],
    tax,
    lines: [
      { id: 'il-base', label: 'Illinois base income estimate', amount: baseIncome },
      { id: 'il-exemption', label: 'Illinois exemption allowance', amount: exemption.amount },
      { id: 'il-net', label: 'Illinois net income estimate', amount: net },
      { id: 'il-tax', label: 'Illinois tax estimate', amount: tax },
    ],
  }
}

function illinoisExemption(rules, status, federalAgi, federal) {
  const overLimit = status === 'mfj' ? federalAgi > rules.agiLimitJoint : federalAgi > rules.agiLimitOther
  if (overLimit) return { amount: 0 }
  let personal = 0
  if (status !== 'mfj') {
    personal = federal.claimedAsDependent && federalAgi > rules.personalExemption ? 0 : rules.personalExemption
  } else {
    const taxpayerClaimed = federal.claimedAsDependent
    const spouseClaimed = federal.spouseClaimed
    if (!taxpayerClaimed && !spouseClaimed) personal = rules.jointExemption
    else if (taxpayerClaimed && spouseClaimed) personal = federalAgi <= rules.jointExemption ? rules.jointExemption : 0
    else personal = federalAgi <= rules.personalExemption ? rules.jointExemption : rules.personalExemption
  }
  let extra = federal.taxpayerAge65 ? rules.seniorOrBlind : 0
  extra += federal.taxpayerBlind ? rules.seniorOrBlind : 0
  if (status === 'mfj') {
    extra += federal.spouseAge65 ? rules.seniorOrBlind : 0
    extra += federal.spouseBlind ? rules.seniorOrBlind : 0
  }
  return { amount: personal + extra + federal.dependentCount * rules.dependentExemption }
}

function numberOrZero(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
