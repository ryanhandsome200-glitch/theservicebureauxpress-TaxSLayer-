import { applyRate, dollarsToCents, roundToDollars } from './format.js'
import { bracketTaxCents, getTaxYearRules } from './tax-rules.js'
import { calculateState } from './tax-state.js'
import { buildFormSet } from './tax-forms.js'

const STATUSES = new Set(['single', 'mfj', 'mfs', 'hoh', 'qss'])

export function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isAge65(dob, taxYear) {
  return isIsoDate(dob) && dob <= `${taxYear - 64}-01-01`
}

export function isUnderAge(dob, taxYear, age) {
  return isIsoDate(dob) && dob >= `${taxYear - (age - 1)}-01-01` && dob <= `${taxYear}-12-31`
}

export function childlessEitcAge(dob, taxYear) {
  if (!isIsoDate(dob)) return false
  return dob <= `${taxYear - 25}-12-31` && dob >= `${taxYear - 64}-01-01`
}

export function standardDeductionAmount(rules, status, flags) {
  const unmarried = status === 'single' || status === 'hoh'
  const additional = unmarried ? rules.additionalStandardDeduction.unmarried : rules.additionalStandardDeduction.married
  let base = rules.standardDeduction[status]
  if (flags.claimedAsDependent) {
    const earned = Math.max(0, flags.earnedIncome || 0)
    base = Math.min(base, Math.max(rules.dependentMinimum, rules.dependentEarnedAdd + earned))
  }
  let count = (flags.taxpayerAge65 ? 1 : 0) + (flags.taxpayerBlind ? 1 : 0)
  if (status === 'mfj' || status === 'mfs' || status === 'qss') {
    count += (flags.spouseAge65 ? 1 : 0) + (flags.spouseBlind ? 1 : 0)
  }
  return roundToDollars(dollarsToCents(base + count * additional))
}

export function saltDeduction(rules, status, magi, taxesPaid) {
  const paid = Math.max(0, taxesPaid)
  const mfs = status === 'mfs'
  const threshold = mfs ? rules.salt.thresholdMfs : rules.salt.threshold
  let limit = rules.salt.base
  if (magi > threshold) {
    const reductionCents = applyRate(dollarsToCents(magi - threshold), rules.salt.reductionRate)
    limit = Math.max(rules.salt.base - reductionCents / 100, rules.salt.floor)
  }
  if (mfs) limit /= 2
  return roundToDollars(dollarsToCents(Math.min(paid, limit)))
}

export function computeSelfEmploymentTax(netProfit, ssWages, rules) {
  const empty = { tax: 0, deductibleHalf: 0, base: 0, socialSecurityCents: 0, medicareCents: 0 }
  if (netProfit <= 0) return empty
  const baseCents = Math.round(dollarsToCents(netProfit) * 9235 / 10000)
  if (baseCents < dollarsToCents(400)) return { ...empty, base: roundToDollars(baseCents) }
  const remaining = Math.max(0, dollarsToCents(rules.socialSecurityWageBase) - dollarsToCents(Math.max(0, ssWages)))
  const socialSecurityCents = Math.round(Math.min(baseCents, remaining) * 124 / 1000)
  const medicareCents = Math.round(baseCents * 29 / 1000)
  const tax = roundToDollars(socialSecurityCents + medicareCents)
  return {
    tax,
    deductibleHalf: roundToDollars(Math.round(tax * 50)),
    base: roundToDollars(baseCents),
    socialSecurityCents,
    medicareCents,
  }
}

export function ordinaryIncomeTax(taxableDollars, status, rules) {
  const bracketStatus = status === 'qss' ? 'mfj' : status
  const income = Math.max(0, roundToDollars(dollarsToCents(taxableDollars)))
  let method = 'worksheet'
  let taxed = income
  if (income < 100000) {
    method = 'tax-table'
    if (income >= 25) taxed = Math.floor(income / 50) * 50 + 25
  }
  const cents = bracketTaxCents(dollarsToCents(taxed), rules.brackets[bracketStatus])
  return { tax: roundToDollars(cents), method, taxedAmount: taxed, cents }
}

export function calculateEitc(rules, status, childCount, earned, agi, investmentIncome) {
  if (investmentIncome > rules.eitc.investmentLimit) {
    return { amount: 0, reason: 'Investment income is over the 2025 limit of $11,950, so the earned income credit is not allowed.' }
  }
  const kids = Math.min(3, Math.max(0, childCount))
  const band = rules.eitc.bands[kids]
  const threshold = status === 'mfj' ? band.phaseoutJoint : band.phaseoutOther
  const earnedBase = Math.min(Math.max(0, earned), band.earnedIncomeAmount)
  let creditCents = Math.min(dollarsToCents(band.maxCredit), applyRate(dollarsToCents(earnedBase), band.creditRate))
  const measure = Math.max(earned, agi)
  if (measure > threshold) creditCents = Math.max(0, creditCents - applyRate(dollarsToCents(measure - threshold), band.phaseRate))
  return { amount: roundToDollars(creditCents), reason: '' }
}

export function calculateChildTaxCredit(rules, status, childCount, magi, taxLiability, earnedIncome) {
  if (childCount <= 0) return { nonrefundable: 0, refundable: 0, total: 0 }
  const threshold = status === 'mfj' ? rules.ctc.phaseoutJoint : rules.ctc.phaseoutOther
  let total = childCount * rules.ctc.perChild
  if (magi > threshold) {
    const steps = Math.ceil((magi - threshold) / 1000)
    total = Math.max(0, total - steps * 50)
  }
  const nonrefundable = Math.min(total, Math.max(0, taxLiability))
  const leftover = total - nonrefundable
  let refundable = 0
  if (earnedIncome > rules.ctc.actcEarnedFloor && leftover > 0) {
    const earnedLimit = roundToDollars(applyRate(dollarsToCents(earnedIncome - rules.ctc.actcEarnedFloor), 0.15))
    refundable = Math.min(leftover, childCount * rules.ctc.actcPerChild, earnedLimit)
  }
  return { nonrefundable, refundable, total }
}

export function studentLoanDeduction(rules, status, interest, magi) {
  if (status === 'mfs') return { amount: 0, reason: 'Married filing separately cannot deduct student loan interest.' }
  const paid = Math.min(rules.studentLoan.maximum, Math.max(0, interest))
  const band = status === 'mfj' || status === 'qss' ? rules.studentLoan.joint : rules.studentLoan.other
  if (magi >= band.end) return { amount: 0, reason: 'Income is at or above the 2025 student-loan phaseout.' }
  if (magi <= band.start) return { amount: roundToDollars(dollarsToCents(paid)), reason: '' }
  const ratio = (band.end - magi) / (band.end - band.start)
  return { amount: roundToDollars(dollarsToCents(paid * ratio)), reason: '' }
}

export function calculateReturn(input) {
  const record = input || {}
  const rules = getTaxYearRules(record.taxYear)
  if (!rules) {
    return { ok: false, errors: [{ code: 'YEAR', message: 'Only tax year 2025 is loaded. No tax was calculated.' }], result: null }
  }
  if (!STATUSES.has(record.filingStatus)) {
    return { ok: false, errors: [{ code: 'STATUS', message: 'Choose a filing status before calculating.' }], result: null }
  }

  const errors = []
  const limitations = []
  const blockers = []
  const status = record.filingStatus
  const lossCap = status === 'mfs' ? rules.capitalLossLimit.mfs : rules.capitalLossLimit.other
  const totals = aggregateIncome(record.incomeItems || [], lossCap, errors, limitations, blockers)
  const lossLimit = status === 'mfj' || status === 'qss' ? rules.excessBusinessLoss.joint : rules.excessBusinessLoss.other
  if (totals.businessProfit < -lossLimit) {
    limitations.push('The 2025 excess business loss limit was applied. The disallowed amount was not carried forward.')
    totals.businessProfit = -lossLimit
  }
  if (errors.length) return { ok: false, errors, result: null }

  if (record.eligibility?.foreignEarnedIncome) blockers.push('Foreign earned income and the foreign earned income exclusion are not calculated.')
  if (record.eligibility?.nonresidentAlien) blockers.push('Form 1040-NR is not supported.')
  if (record.eligibility?.estateOrTrust) blockers.push('Estate and trust returns are not supported.')
  if (totals.collectibles > 0) blockers.push('Collectibles gain is included as ordinary income. The 28% maximum rate is not applied, so this return cannot be submitted.')

  const people = peopleFlags(record, rules.taxYear, totals.earnedSeed)
  const se = computeSelfEmploymentTax(Math.max(0, totals.businessProfit), totals.ssWages, rules)
  const adjustments = adjustmentsOf(record, rules, status, totals, se, limitations)
  const gross = roundToDollars(dollarsToCents(
    totals.wages + totals.taxableInterest + totals.ordinaryDividends + totals.unemployment
    + totals.taxableRetirement + totals.taxableSocialSecurity + totals.otherIncome
    + totals.shortTerm + totals.longTerm + totals.collectibles + totals.businessProfit + totals.rentalProfit
    - totals.lossDeduction,
  ))
  const agi = roundToDollars(dollarsToCents(gross - adjustments.total))
  const deduction = deductionOf(record, rules, status, agi, people, totals, limitations)
  const taxableBeforeQbi = Math.max(0, roundToDollars(dollarsToCents(agi - deduction.amount)))
  const qbi = qbiDeduction(rules, status, totals.qbi, taxableBeforeQbi, totals.longTerm, totals.qualifiedDividends, limitations)
  const taxableIncome = Math.max(0, roundToDollars(dollarsToCents(taxableBeforeQbi - qbi.amount)))
  const preferentialBase = Math.max(0, totals.longTerm + totals.qualifiedDividends)
  const preferential = Math.min(taxableIncome, preferentialBase)
  const ordinaryPortion = Math.max(0, taxableIncome - preferential)
  const incomeTax = incomeTaxOf(ordinaryPortion, preferential, status, rules, limitations)
  const additionalMedicare = additionalMedicareTax(rules, status, totals, se.base)
  const niit = netInvestmentTax(status, agi, totals, limitations)
  const earlyPenalty = roundToDollars(applyRate(dollarsToCents(totals.earlyDistributionBase), 0.1))
  const totalTaxBeforeCredits = incomeTax.tax + se.tax + additionalMedicare.tax + niit.tax + earlyPenalty
  const earnedIncome = Math.max(0, roundToDollars(dollarsToCents(totals.wages + totals.businessProfit - se.deductibleHalf)))
  const credits = creditAmounts(record, rules, status, agi, taxableIncome, totalTaxBeforeCredits, earnedIncome, totals, people, limitations)
  const taxAfterCredits = Math.max(0, totalTaxBeforeCredits - credits.nonrefundable)
  const payments = roundToDollars(dollarsToCents(totals.withholding + totals.additionalMedicareWithheld + number(record.payments?.estimatedFederal)))
  const settlement = payments + credits.refundable - taxAfterCredits
  const balance = roundToDollars(dollarsToCents(settlement))

  if (taxableIncome > (rules.amtExemption[status] || 0)) {
    limitations.push('Alternative minimum tax is not calculated. If it applies, this estimate can be understated.')
  }
  if (totals.rentalLossSuspended > 0) {
    limitations.push(`A rental loss of ${totals.rentalLossSuspended} was not deducted. The passive-activity allowance is not calculated.`)
  }
  if (number(record.adjustments?.iraDeduction) > 0) {
    limitations.push('A deductible IRA amount was entered and was not subtracted. The workplace-plan phaseout is not calculated in this version.')
  }

  const federal = {
    taxYear: rules.taxYear,
    filingStatus: status,
    agi,
    earnedIncome,
    medical: number(record.deductions?.medical),
    realEstate: number(record.deductions?.realEstate),
    personalProperty: number(record.deductions?.personalProperty),
    mortgage: number(record.deductions?.mortgageInterest),
    charity: number(record.deductions?.charityCash) + number(record.deductions?.charityNoncash),
    claimedAsDependent: people.claimedAsDependent,
    spouseClaimed: people.spouseClaimed,
    taxpayerAge65: people.taxpayerAge65,
    spouseAge65: people.spouseAge65,
    taxpayerBlind: people.taxpayerBlind,
    spouseBlind: people.spouseBlind,
    dependentCount: (record.dependents || []).length,
    taxableSocialSecurity: totals.taxableSocialSecurity,
    stateWithholding: totals.stateWithholding,
  }
  const state = calculateState(record, federal)
  blockers.push(...state.blockers)

  const result = {
    ok: blockers.length === 0,
    taxYear: rules.taxYear,
    rulesVersion: rules.version,
    verification: rules.overallStatus,
    coverage: 'estimate',
    filingStatus: status,
    grossIncome: gross,
    adjustments,
    agi,
    deduction,
    qbi,
    taxableIncome,
    incomeTax,
    selfEmployment: se,
    additionalMedicare,
    niit,
    earlyWithdrawalPenalty: earlyPenalty,
    totalTaxBeforeCredits,
    credits,
    taxAfterCredits,
    payments,
    refund: balance > 0 ? balance : 0,
    amountDue: balance < 0 ? Math.abs(balance) : 0,
    balance,
    earnedIncome,
    totals,
    limitations,
    blockers,
    state,
    estimateNotice: 'This is an estimate for review. It is not a filed return, and it is not an IRS acceptance.',
  }
  result.forms = buildFormSet(record, result)
  return { ok: true, errors: [], result }
}

function aggregateIncome(items, lossCap, errors, limitations, blockers) {
  const totals = {
    wages: 0, taxableInterest: 0, taxExemptInterest: 0, ordinaryDividends: 0, qualifiedDividends: 0,
    unemployment: 0, taxableRetirement: 0, taxableSocialSecurity: 0, otherIncome: 0,
    shortTermRaw: 0, longTermRaw: 0, collectibles: 0, businessProfit: 0, rentalProfit: 0,
    rentalLossSuspended: 0, qbi: 0, withholding: 0, stateWithholding: 0, ssWages: 0,
    medicareWages: 0, additionalMedicareWithheld: 0, earlyDistributionBase: 0, earnedSeed: 0,
    shortTerm: 0, longTerm: 0, lossDeduction: 0, capitalCarryover: 0,
  }
  items.forEach((item, index) => {
    if (item.confirmed === false) {
      blockers.push(`Income item ${index + 1} has unconfirmed extracted values and was excluded.`)
      return
    }
    const label = item.payerName || item.description || `Income item ${index + 1}`
    const amount = (field, allowNegative = false) => readAmount(item[field], `${label} ${field}`, errors, allowNegative)
    if (item.type === 'w2') {
      const wages = amount('wages')
      totals.wages += wages
      totals.withholding += amount('federalWithholding')
      totals.ssWages += item.ssWages == null || item.ssWages === '' ? wages : amount('ssWages')
      totals.medicareWages += item.medicareWages == null || item.medicareWages === '' ? wages : amount('medicareWages')
      totals.stateWithholding += amount('stateWithholding')
      totals.additionalMedicareWithheld += amount('additionalMedicareWithheld')
    } else if (item.type === '1099-int') {
      totals.taxableInterest += amount('interest')
      totals.taxExemptInterest += amount('taxExemptInterest')
      totals.withholding += amount('federalWithholding')
    } else if (item.type === '1099-div') {
      const ordinary = amount('ordinaryDividends')
      const qualified = amount('qualifiedDividends')
      if (qualified > ordinary) errors.push({ code: 'DIVIDENDS', message: `${label} has qualified dividends greater than ordinary dividends.` })
      totals.ordinaryDividends += ordinary
      totals.qualifiedDividends += Math.min(qualified, ordinary)
      totals.withholding += amount('federalWithholding')
    } else if (item.type === '1099-nec' || item.type === 'schedule-c') {
      const gross = amount(item.type === '1099-nec' ? 'compensation' : 'grossReceipts')
      const expenses = amount('expenses')
      const profit = gross - expenses
      totals.businessProfit += profit
      totals.qbi += profit
      totals.withholding += amount('federalWithholding')
    } else if (item.type === '1099-misc') {
      totals.withholding += amount('federalWithholding')
      if (item.treatAsBusiness) {
        const profit = amount('otherIncome') - amount('expenses')
        totals.businessProfit += profit
        totals.qbi += profit
      } else {
        const rents = amount('rents')
        const other = amount('otherIncome')
        addRental(totals, limitations, rents, 0)
        totals.otherIncome += other
      }
    } else if (item.type === '1099-r') {
      totals.taxableRetirement += amount('taxableAmount')
      totals.withholding += amount('federalWithholding')
      if (item.earlyDistribution === 'no-exception') totals.earlyDistributionBase += amount('taxableAmount')
      if (item.earlyDistribution === 'exception') limitations.push(`${label}: an early-distribution exception was attested and was not verified.`)
    } else if (item.type === 'unemployment') {
      totals.unemployment += amount('amount')
      totals.withholding += amount('federalWithholding')
    } else if (item.type === 'social-security') {
      if (item.noneTaxable) totals.taxableSocialSecurity += 0
      else totals.taxableSocialSecurity += amount('taxableAmount')
    } else if (item.type === 'schedule-e') {
      addRental(totals, limitations, amount('rents'), amount('expenses'))
      if (item.qbi && amount('rents') >= amount('expenses')) totals.qbi += amount('rents') - amount('expenses')
    } else if (item.type === 'capital-gain') {
      const gain = amount('proceeds') - amount('basis')
      if (item.collectible) totals.collectibles += gain
      else if (item.term === 'long') totals.longTermRaw += gain
      else totals.shortTermRaw += gain
    } else if (item.type === 'other') {
      totals.otherIncome += amount('amount')
      totals.withholding += amount('federalWithholding')
    } else if (item.type) {
      errors.push({ code: 'INCOME_TYPE', message: `${item.type} is not a supported income type.` })
    }
  })
  const netted = netCapital(totals.shortTermRaw, totals.longTermRaw, lossCap)
  totals.shortTerm = netted.shortTerm
  totals.longTerm = netted.longTerm
  totals.lossDeduction = netted.lossDeduction
  totals.capitalCarryover = netted.carryover
  totals.earnedSeed = totals.wages + Math.max(0, totals.businessProfit)
  return totals
}

function addRental(totals, limitations, rents, expenses) {
  const net = rents - expenses
  if (net >= 0) totals.rentalProfit += net
  else {
    totals.rentalLossSuspended += Math.abs(net)
    limitations.push('A rental loss was entered and was not deducted.')
  }
}

export function netCapital(shortTermRaw, longTermRaw, lossCap = 3000) {
  let shortTerm = shortTermRaw
  let longTerm = longTermRaw
  if (shortTerm < 0 && longTerm > 0) {
    longTerm += shortTerm
    shortTerm = 0
    if (longTerm < 0) {
      shortTerm = longTerm
      longTerm = 0
    }
  } else if (longTerm < 0 && shortTerm > 0) {
    shortTerm += longTerm
    longTerm = 0
    if (shortTerm < 0) {
      longTerm = shortTerm
      shortTerm = 0
    }
  }
  const net = shortTerm + longTerm
  if (net >= 0) return { shortTerm, longTerm, lossDeduction: 0, carryover: 0 }
  const lossDeduction = Math.min(lossCap, Math.abs(net))
  return { shortTerm: 0, longTerm: 0, lossDeduction, carryover: Math.abs(net) - lossDeduction }
}

function peopleFlags(record, taxYear, earnedIncome) {
  const taxpayer = record.taxpayer || {}
  const spouse = record.spouse || {}
  return {
    claimedAsDependent: Boolean(taxpayer.claimedAsDependent),
    spouseClaimed: Boolean(spouse.claimedAsDependent),
    taxpayerAge65: isAge65(taxpayer.dateOfBirth, taxYear),
    spouseAge65: isAge65(spouse.dateOfBirth, taxYear),
    taxpayerBlind: Boolean(taxpayer.blind),
    spouseBlind: Boolean(spouse.blind),
    earnedIncome,
  }
}

function adjustmentsOf(record, rules, status, totals, se, limitations) {
  const educatorTaxpayer = Math.min(rules.educatorExpenseCap, Math.max(0, number(record.adjustments?.educatorTaxpayer)))
  const educatorSpouse = status === 'mfj' ? Math.min(rules.educatorExpenseCap, Math.max(0, number(record.adjustments?.educatorSpouse))) : 0
  const preLoanAgi = Math.max(0, totals.wages + totals.taxableInterest + totals.ordinaryDividends + totals.unemployment + totals.taxableRetirement + totals.taxableSocialSecurity + totals.otherIncome + totals.shortTerm + totals.longTerm + totals.collectibles + totals.businessProfit + totals.rentalProfit - totals.lossDeduction - educatorTaxpayer - educatorSpouse - se.deductibleHalf)
  const loan = studentLoanDeduction(rules, status, number(record.adjustments?.studentLoanInterest), preLoanAgi)
  if (loan.reason) limitations.push(loan.reason)
  const educator = educatorTaxpayer + educatorSpouse
  return {
    educator,
    studentLoan: loan.amount,
    selfEmployment: se.deductibleHalf,
    total: roundToDollars(dollarsToCents(educator + loan.amount + se.deductibleHalf)),
  }
}

function deductionOf(record, rules, status, agi, people, totals, limitations) {
  const standard = record.deductions?.spouseMustItemize ? 0 : standardDeductionAmount(rules, status, people)
  const salt = saltDeduction(rules, status, agi, number(record.deductions?.stateLocalIncomeOrSales) + number(record.deductions?.realEstate) + number(record.deductions?.personalProperty))
  const medical = Math.max(0, roundToDollars(dollarsToCents(number(record.deductions?.medical) - agi * rules.medicalFloor)))
  const cash = Math.min(number(record.deductions?.charityCash), agi * rules.charity.cashAgi)
  const noncash = Math.min(number(record.deductions?.charityNoncash), agi * rules.charity.noncashAgi)
  if (cash < number(record.deductions?.charityCash) || noncash < number(record.deductions?.charityNoncash)) {
    limitations.push('Charitable contributions were limited with a simplified AGI ceiling. The entered amounts were not changed.')
  }
  const itemized = roundToDollars(dollarsToCents(medical + salt + number(record.deductions?.mortgageInterest) + cash + noncash))
  const choice = record.deductions?.choice || 'larger'
  let method = 'standard'
  let amount = standard
  if (record.deductions?.spouseMustItemize || choice === 'itemized' || (choice === 'larger' && itemized > standard)) {
    method = 'itemized'
    amount = itemized
  }
  if (number(record.deductions?.mortgageInterest) > 0) {
    limitations.push('Mortgage interest is included as entered. The acquisition-debt limit is not calculated.')
  }
  return { method, amount, standard, itemized, salt, medical, charity: roundToDollars(dollarsToCents(cash + noncash)) }
}

function qbiDeduction(rules, status, qbiIncome, taxableBeforeQbi, longTerm, qualifiedDividends, limitations) {
  const positive = Math.max(0, qbiIncome)
  if (positive <= 0 || taxableBeforeQbi <= 0) return { amount: 0 }
  if (taxableBeforeQbi > rules.qbiThreshold[status]) {
    limitations.push('Qualified business income is above the 2025 threshold. The wage and property limitation is not calculated, so the deduction was not applied.')
    return { amount: 0 }
  }
  const gain = Math.max(0, longTerm + qualifiedDividends)
  const base = Math.max(0, taxableBeforeQbi - gain)
  const amount = roundToDollars(dollarsToCents(Math.min(positive, base) * 0.2))
  return { amount }
}

function incomeTaxOf(ordinaryPortion, preferential, status, rules, limitations) {
  if (preferential <= 0) {
    const ordinary = ordinaryIncomeTax(ordinaryPortion, status, rules)
    return { tax: ordinary.tax, method: ordinary.method, ordinaryTax: ordinary.tax, preferentialTax: 0, taxedAmount: ordinary.taxedAmount }
  }
  limitations.push('Qualified dividends or long-term capital gain are present, so income tax uses the rate schedule rather than the under-$100,000 tax table. Unrecaptured section 1250 gain is not separately rated.')
  const bands = rules.capitalGains[status]
  const zeroRoom = Math.max(0, bands.zero - ordinaryPortion)
  const atZero = Math.min(preferential, zeroRoom)
  const afterZero = preferential - atZero
  const fifteenRoom = Math.max(0, bands.fifteen - ordinaryPortion - atZero)
  const atFifteen = Math.min(afterZero, fifteenRoom)
  const atTwenty = afterZero - atFifteen
  const bracketStatus = status === 'qss' ? 'mfj' : status
  const ordinaryCents = bracketTaxCents(dollarsToCents(ordinaryPortion), rules.brackets[bracketStatus])
  const prefCents = applyRate(dollarsToCents(atFifteen), 0.15) + applyRate(dollarsToCents(atTwenty), 0.2)
  return {
    tax: roundToDollars(ordinaryCents + prefCents),
    method: 'capital-gain-worksheet',
    ordinaryTax: roundToDollars(ordinaryCents),
    preferentialTax: roundToDollars(prefCents),
    atZero,
    atFifteen,
    atTwenty,
  }
}

function additionalMedicareTax(rules, status, totals, seBase) {
  const threshold = status === 'mfj' ? 250000 : status === 'mfs' ? 125000 : 200000
  const combined = totals.medicareWages + seBase
  const tax = combined > threshold ? roundToDollars(applyRate(dollarsToCents(combined - threshold), 0.009)) : 0
  return { tax, threshold, note: tax ? 'Simplified Form 8959. This is not a full additional Medicare reconciliation.' : '' }
}

function netInvestmentTax(status, agi, totals, limitations) {
  const threshold = status === 'mfj' ? 250000 : status === 'mfs' ? 125000 : 200000
  const nii = Math.max(0, totals.taxableInterest + totals.ordinaryDividends + totals.shortTerm + totals.longTerm + totals.rentalProfit)
  const base = Math.min(nii, Math.max(0, agi - threshold))
  const tax = base > 0 ? roundToDollars(applyRate(dollarsToCents(base), 0.038)) : 0
  if (tax > 0) limitations.push('Net investment income tax is a simplified Form 8960 estimate.')
  return { tax }
}

function creditAmounts(record, rules, status, agi, taxableIncome, taxBefore, earnedIncome, totals, people, limitations) {
  const credits = record.credits || {}
  const ctcKids = (record.dependents || []).filter((dependent) => dependent.qualifyingChild !== false && isUnderAge(dependent.dateOfBirth, rules.taxYear, 17) && Number(dependent.monthsLived || 0) >= 7).length
  let ctc = { nonrefundable: 0, refundable: 0, total: 0 }
  if (credits.claimCtc && credits.ssnAttested && ctcKids > 0) {
    ctc = calculateChildTaxCredit(rules, status, ctcKids, agi, taxBefore, earnedIncome)
    limitations.push('Child tax credit SSN eligibility was attested. This sandbox does not verify a Social Security number.')
  }
  let eitc = { amount: 0, reason: '' }
  if (credits.claimEitc) {
    const eitcKids = (record.dependents || []).filter((dependent) => qualifiesForEitc(dependent, rules.taxYear)).length
    const ageOk = eitcKids > 0 || childlessEitcAge(record.taxpayer?.dateOfBirth, rules.taxYear) || (status === 'mfj' && childlessEitcAge(record.spouse?.dateOfBirth, rules.taxYear))
    const mfsBlocked = status === 'mfs' && !credits.separatedSpouseEitc
    const investment = totals.taxableInterest + totals.taxExemptInterest + totals.ordinaryDividends + Math.max(0, totals.longTerm + totals.shortTerm - totals.lossDeduction)
    if (!ageOk) eitc.reason = 'The age test for the earned income credit is not met.'
    else if (mfsBlocked) eitc.reason = 'Married filing separately is not eligible for the earned income credit unless the special separated-spouse rule is attested.'
    else eitc = calculateEitc(rules, status, eitcKids, earnedIncome, agi, investment)
    if (eitc.reason) limitations.push(eitc.reason)
  }
  const education = educationCredit(rules, status, credits, agi)
  if (education.reason) limitations.push(education.reason)
  const desiredNonrefundable = ctc.nonrefundable + education.nonrefundable
  const nonrefundable = Math.min(taxBefore, desiredNonrefundable)
  return {
    childCount: ctcKids,
    childTaxCredit: ctc.nonrefundable,
    additionalChildTaxCredit: ctc.refundable,
    eitc: eitc.amount,
    educationNonrefundable: education.nonrefundable,
    educationRefundable: education.refundable,
    nonrefundable,
    refundable: ctc.refundable + eitc.amount + education.refundable,
    taxableIncome,
  }
}

function qualifiesForEitc(dependent, taxYear) {
  if (dependent.qualifyingChild === false) return false
  if (Number(dependent.monthsLived || 0) < 7) return false
  if (dependent.disabled) return true
  if (isUnderAge(dependent.dateOfBirth, taxYear, 19)) return true
  return Boolean(dependent.student) && isUnderAge(dependent.dateOfBirth, taxYear, 24)
}

function educationCredit(rules, status, credits, magi) {
  if (!credits.claimEducation) return { nonrefundable: 0, refundable: 0, reason: '' }
  const expenses = Math.max(0, number(credits.educationExpenses))
  let tentative = 0
  if (credits.educationType === 'llc') {
    tentative = Math.min(rules.education.llcMax, expenses * 0.2)
  } else {
    if (!credits.educationHalfTime || number(credits.educationYearsClaimed) >= 4) {
      return { nonrefundable: 0, refundable: 0, reason: 'The American opportunity credit was not applied. It requires half-time enrollment and fewer than four prior-year claims.' }
    }
    tentative = Math.min(2000, expenses) + Math.min(2000, Math.max(0, expenses - 2000)) * 0.25
  }
  const band = status === 'mfj' || status === 'qss' ? rules.education.phaseoutJoint : rules.education.phaseoutOther
  if (magi >= band.end) tentative = 0
  else if (magi > band.start) tentative *= (band.end - magi) / (band.end - band.start)
  tentative = roundToDollars(dollarsToCents(tentative))
  if (credits.educationType === 'llc') {
    return { nonrefundable: tentative, refundable: 0, reason: 'Lifetime learning credit uses the statutory formula. Confirm it on 2025 Form 8863. Only one student is calculated.' }
  }
  const refundable = Math.min(1000, roundToDollars(applyRate(dollarsToCents(tentative), 0.4)))
  return {
    nonrefundable: tentative - refundable,
    refundable,
    reason: 'American opportunity credit uses the statutory formula. Confirm it on 2025 Form 8863. Only one student is calculated.',
  }
}

function readAmount(value, label, errors, allowNegative) {
  if (value === '' || value == null) return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n)) {
    errors.push({ code: 'AMOUNT', message: `${label} is not a valid number.` })
    return 0
  }
  if (!allowNegative && n < 0) {
    errors.push({ code: 'AMOUNT', message: `${label} cannot be negative.` })
    return 0
  }
  return n
}

function number(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
