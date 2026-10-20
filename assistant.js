const GUIDES = [
  { keys: ['standard deduction'], title: 'Standard deduction', text: 'The standard deduction is a fixed amount based on filing status, age, and blindness. For 2025 the basic amounts loaded here are $15,750 single or married filing separately, $31,500 joint or qualifying surviving spouse, and $23,625 head of household. Source: Rev. Proc. 2025-32.', href: 'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets' },
  { keys: ['agi', 'adjusted gross'], title: 'Adjusted gross income', text: 'Adjusted gross income is total income minus specific adjustments, such as the deductible half of self-employment tax, educator expenses, and deductible student-loan interest. It is not the same number as taxable income.', href: 'https://www.irs.gov/e-file-providers/definition-of-adjusted-gross-income' },
  { keys: ['taxable income'], title: 'Taxable income', text: 'Taxable income is adjusted gross income minus either the standard deduction or itemized deductions, and minus a qualified business income deduction when one is allowed.', href: 'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets' },
  { keys: ['credit', 'deduction'], title: 'Credit and deduction', text: 'A deduction reduces income before the tax is calculated. A credit reduces the tax itself. A refundable credit can reduce the tax below zero. This assistant does not promise that you qualify for either.', href: 'https://www.irs.gov/credits-and-deductions-for-individuals' },
  { keys: ['withholding'], title: 'Withholding', text: 'Withholding is income tax already paid through a payer, usually the federal income tax withheld box on a W-2 or 1099. It is a payment, not income.', href: 'https://www.irs.gov/payments' },
  { keys: ['filing status'], title: 'Filing status', text: 'Filing status changes the rate schedule, the standard deduction, and several credit phaseouts. The status has to match the facts, such as marital status and whether a qualifying person lives with you.', href: 'https://www.irs.gov/help/ita/what-is-my-filing-status' },
  { keys: ['earned income', 'eitc'], title: 'Earned income credit', text: 'The 2025 earned income credit depends on earned income, adjusted gross income, filing status, investment income, and the number of qualifying children. Investment income over $11,950 blocks the credit. This application uses the Rev. Proc. 2024-40 parameters and still cannot confirm every eligibility rule.', href: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-and-earned-income-tax-credit-eitc-tables' },
  { keys: ['child tax'], title: 'Child tax credit', text: 'For 2025 the credit is worth up to $2,200 per qualifying child under 17. It begins to phase out above $200,000 of income, or $400,000 for a joint return. A Social Security number requirement applies, and this sandbox cannot verify one.', href: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit' },
  { keys: ['self-employment', 'schedule se'], title: 'Self-employment tax', text: 'Net self-employment earnings are generally 92.35% of net profit. For 2025, the Social Security portion applies up to the $176,100 wage base and the Medicare portion has no wage base. Half of the self-employment tax is an adjustment to income.', href: 'https://www.irs.gov/instructions/i1040sse' },
]

const STEPS = {
  income: 'Enter each payer separately. A W-2 box 1 amount is wages. Do not also enter that same wage amount as other income.',
  deductions: 'Compare the standard deduction with itemized deductions. This application chooses the larger amount unless you override it. Mortgage interest limits are not calculated.',
  credits: 'A credit is applied only after you claim it and the loaded eligibility tests pass. Nothing here guarantees a refund.',
  state: 'Full-year California and Illinois returns have limited calculations. Other states are not calculated.',
  submit: 'The sandbox does not transmit a return. Acceptance is shown only when a configured provider returns that status.',
  fees: 'The fee summary is the configured preparation charge. A browser redirect is not treated as a paid order.',
}

export async function answerTaxQuestion({ question, step, apiBaseUrl, fetchImpl }) {
  const context = { step, taxYear: 2025 }
  if (apiBaseUrl) {
    try {
      const response = await fetchImpl(`${apiBaseUrl}/v1/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question, context }),
      })
      if (response.ok) {
        const payload = await response.json()
        if (payload?.answer && payload.liveModel === true) {
          return { ...payload, applied: false, notice: 'This answer does not change the return or submit it.' }
        }
      }
    } catch {
      // Fall through to the local glossary. The failure is disclosed below.
    }
  }
  const local = localAnswer(question, step)
  return {
    ...local,
    provider: 'guided-help',
    liveModel: false,
    applied: false,
    notice: apiBaseUrl
      ? 'The assistant service did not return a verified answer. Showing the local glossary only.'
      : 'A live model is not connected. This answer comes from the local glossary.',
  }
}

export function localAnswer(question, step) {
  const text = String(question || '').toLowerCase()
  const guide = GUIDES.find((item) => item.keys.some((key) => text.includes(key)))
  if (guide) return { title: guide.title, answer: guide.text, href: guide.href }
  if (STEPS[step] && text.trim()) {
    return { title: 'This step', answer: `${STEPS[step]} I do not have a verified answer to the rest of that question. Check IRS.gov or a credentialed tax professional.`, href: 'https://www.irs.gov/' }
  }
  return {
    title: 'No verified answer',
    answer: 'I do not have a verified answer for that question. This guided help is not a live tax model, and it cannot say how the law applies to a specific set of facts.',
    href: 'https://www.irs.gov/',
  }
}

export function stepHint(step) {
  return STEPS[step] || 'Use the glossary for terms that are loaded. This panel cannot file a return or change a calculation.'
}
