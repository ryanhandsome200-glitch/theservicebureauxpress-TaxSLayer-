import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { answerTaxQuestion, stepHint } from './assistant.js'
import { CheckInput, Money, MoneyInput, Notice, SelectInput, TextInput } from './components.jsx'
import { INCOME_TYPES, WIZARD_STEPS, createDependent, createIncomeItem } from './models.js'
import { useApp } from './store.jsx'
import { PRODUCTS } from './tax-rules.js'
import { validateStep } from './tax-validation.js'

export function Dashboard() {
  const { backend } = useApp()
  const navigate = useNavigate()
  const returns = backend.listReturns()
  const notes = backend.notifications()
  async function start() {
    const created = await backend.createReturn()
    if (created.ok) navigate(`/returns/${created.return.id}/year`)
  }
  return (
    <section className="stack">
      <div className="row">
        <div>
          <h1>Your 2025 workspace</h1>
          <p className="muted">Progress is calculated from the returns in this session.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={start}>Start a new return</button>
      </div>
      {notes.length ? notes.map((note) => <Notice key={note.id}>{note.text}</Notice>) : <Notice>No reminders yet.</Notice>}
      {returns.length ? (
        <div className="cards">
          {returns.map((record) => {
            const result = record.calculation?.result
            return (
              <article key={record.id} className="card">
                <h2>Tax year {record.taxYear}</h2>
                <p>{record.completion?.percent ?? 0}% of required steps have no errors.</p>
                <p>{result ? <><Money value={result.refund} /> estimated refund · <Money value={result.amountDue} /> estimated amount due</> : 'Calculation starts after you choose a filing status.'}</p>
                <p>Federal status: {record.status}. State: {result?.state?.prepared ? result.state.code : 'not prepared'}.</p>
                <ul>{(record.validation?.errors || []).slice(0, 4).map((item) => <li key={item.message}>{item.message}</li>)}</ul>
                <div className="actions">
                  <Link className="btn btn-primary" to={`/returns/${record.id}/${record.step || 'year'}`}>Continue return</Link>
                  <Link className="btn btn-secondary" to={`/returns/${record.id}/summary`}>Unofficial summary</Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : <Notice>No returns yet. Start one when you are ready.</Notice>}
    </section>
  )
}

export function Wizard() {
  const { id, step } = useParams()
  const { backend } = useApp()
  const navigate = useNavigate()
  const loaded = backend.getReturn(id)
  const [draft, setDraft] = useState(loaded.ok ? loaded.return : null)
  const [message, setMessage] = useState('')
  const index = Math.max(0, WIZARD_STEPS.findIndex((item) => item.id === step))
  const current = WIZARD_STEPS[index]
  const findings = useMemo(() => draft ? validateStep(draft, current.id, draft.calculation) : [], [draft, current.id])
  const errors = findings.filter((item) => item.severity === 'error')

  if (!loaded.ok || !draft) return <Notice tone="error">That return is not in this session.</Notice>

  function update(patch) {
    setDraft({ ...draft, ...patch })
  }
  async function save(nextStep) {
    const saved = await backend.saveReturn(id, { ...draft, step: nextStep || current.id })
    if (!saved.ok) { setMessage(saved.error.message); return null }
    setDraft(saved.return)
    setMessage(`Saved in this browser session at ${new Date(saved.return.updatedAt).toLocaleTimeString()}.`)
    return saved.return
  }
  async function next() {
    if (errors.length) return
    const following = WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, index + 1)]
    if (!await save(following.id)) return
    navigate(`/returns/${id}/${following.id}`)
  }
  async function back() {
    const previous = WIZARD_STEPS[Math.max(0, index - 1)]
    if (!await save(previous.id)) return
    navigate(`/returns/${id}/${previous.id}`)
  }

  return (
    <section className="wizard">
      <div className="step-head">
        <p className="kicker">Step {index + 1} of {WIZARD_STEPS.length}</p>
        <h1 tabIndex={-1}>{current.label}</h1>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={WIZARD_STEPS.length} aria-valuenow={index + 1} aria-valuetext={current.label} />
      </div>
      <div className="field">
        <label htmlFor="step-jump">Go to a step</label>
        <select id="step-jump" value={current.id} onChange={async (event) => { if (await save(event.target.value)) navigate(`/returns/${id}/${event.target.value}`) }}>
          {WIZARD_STEPS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      {message ? <Notice tone="ok">{message}</Notice> : null}
      {errors.map((item) => <Notice tone="error" key={item.message}>{item.message}</Notice>)}
      <StepBody draft={draft} update={update} step={current.id} />
      <HelpBox step={current.id} />
      <div className="actions">
        <button className="btn btn-secondary" type="button" onClick={back} disabled={index === 0}>Back</button>
        <button className="btn btn-primary" type="button" onClick={next} disabled={index === WIZARD_STEPS.length - 1 || errors.length > 0}>Save and continue</button>
      </div>
    </section>
  )
}

function StepBody({ draft, update, step }) {
  const { backend } = useApp()
  const result = draft.calculation?.result
  if (step === 'year') return <p>Tax year 2025 is loaded. Other years are not calculated.</p>
  if (step === 'eligibility') return (
    <div className="stack">
      <CheckInput id="nonresidentAlien" label="I am a nonresident alien filing Form 1040-NR." checked={draft.eligibility.nonresidentAlien} onChange={(nonresidentAlien) => update({ eligibility: { ...draft.eligibility, nonresidentAlien } })} />
      <CheckInput id="estateOrTrust" label="This is an estate or trust return." checked={draft.eligibility.estateOrTrust} onChange={(estateOrTrust) => update({ eligibility: { ...draft.eligibility, estateOrTrust } })} />
      <CheckInput id="foreignEarnedIncome" label="I need the foreign earned income exclusion." checked={draft.eligibility.foreignEarnedIncome} onChange={(foreignEarnedIncome) => update({ eligibility: { ...draft.eligibility, foreignEarnedIncome } })} />
      <CheckInput id="digitalAssets" label="I received or sold a digital asset." checked={draft.eligibility.digitalAssets} onChange={(digitalAssets) => update({ eligibility: { ...draft.eligibility, digitalAssets } })} />
    </div>
  )
  if (step === 'taxpayer') return <PersonFields person={draft.taxpayer} onChange={(taxpayer) => update({ taxpayer })} prefix="taxpayer" />
  if (step === 'spouse') return (
    <div className="stack">
      <CheckInput id="married" label="I was married at the end of 2025 and will enter a spouse." checked={draft.married} onChange={(married) => update({ married })} />
      {draft.married ? <PersonFields person={draft.spouse} onChange={(spouse) => update({ spouse })} prefix="spouse" /> : <p>Spouse details are not required for an unmarried filer.</p>}
    </div>
  )
  if (step === 'address') return (
    <div className="stack">
      <TextInput id="line1" label="Street address" value={draft.address.line1} onChange={(line1) => update({ address: { ...draft.address, line1 } })} />
      <TextInput id="city" label="City" value={draft.address.city} onChange={(city) => update({ address: { ...draft.address, city } })} />
      <TextInput id="state" label="State" value={draft.address.state} onChange={(state) => update({ address: { ...draft.address, state: state.toUpperCase() } })} hint="Two letters. CA and IL have full-year calculations." />
      <TextInput id="postalCode" label="ZIP code" value={draft.address.postalCode} onChange={(postalCode) => update({ address: { ...draft.address, postalCode } })} />
      <SelectInput id="residency" label="Residency" value={draft.address.residency} onChange={(residency) => update({ address: { ...draft.address, residency } })} options={[{ value: 'full-year', label: 'Full-year resident' }, { value: 'part-year', label: 'Part-year resident' }, { value: 'nonresident', label: 'Nonresident' }]} />
    </div>
  )
  if (step === 'status') return (
    <div className="stack">
      <SelectInput id="filingStatus" label="Filing status" value={draft.filingStatus} onChange={(filingStatus) => update({ filingStatus })} options={[{ value: '', label: 'Choose one' }, { value: 'single', label: 'Single' }, { value: 'mfj', label: 'Married filing jointly' }, { value: 'mfs', label: 'Married filing separately' }, { value: 'hoh', label: 'Head of household' }, { value: 'qss', label: 'Qualifying surviving spouse' }]} />
      <CheckInput id="hohQualifyingPerson" label="A qualifying person lived with me for head of household." checked={draft.eligibility.hohQualifyingPerson} onChange={(hohQualifyingPerson) => update({ eligibility: { ...draft.eligibility, hohQualifyingPerson } })} />
      <TextInput id="spouseDeathYear" label="Year of spouse’s death, if qualifying surviving spouse" value={draft.eligibility.spouseDeathYear} onChange={(spouseDeathYear) => update({ eligibility: { ...draft.eligibility, spouseDeathYear } })} />
    </div>
  )
  if (step === 'dependents') return <Dependents draft={draft} update={update} />
  if (step === 'income') return <IncomeEditor draft={draft} update={update} returnId={draft.id} backend={backend} />
  if (step === 'adjustments') return (
    <div className="stack">
      <MoneyInput id="educatorTaxpayer" label="Your educator expenses" value={draft.adjustments.educatorTaxpayer} onChange={(educatorTaxpayer) => update({ adjustments: { ...draft.adjustments, educatorTaxpayer } })} hint="Capped at $300 by the 2025 rule." />
      <MoneyInput id="educatorSpouse" label="Spouse educator expenses" value={draft.adjustments.educatorSpouse} onChange={(educatorSpouse) => update({ adjustments: { ...draft.adjustments, educatorSpouse } })} />
      <MoneyInput id="studentLoanInterest" label="Student loan interest paid" value={draft.adjustments.studentLoanInterest} onChange={(studentLoanInterest) => update({ adjustments: { ...draft.adjustments, studentLoanInterest } })} />
      <MoneyInput id="iraDeduction" label="IRA deduction you want considered" value={draft.adjustments.iraDeduction} onChange={(iraDeduction) => update({ adjustments: { ...draft.adjustments, iraDeduction } })} hint="This amount is stored and is not subtracted. The phaseout is not calculated." />
    </div>
  )
  if (step === 'deductions') return (
    <div className="stack">
      <SelectInput id="choice" label="Deduction choice" value={draft.deductions.choice} onChange={(choice) => update({ deductions: { ...draft.deductions, choice } })} options={[{ value: 'larger', label: 'Use the larger of standard or itemized' }, { value: 'standard', label: 'Force the standard deduction' }, { value: 'itemized', label: 'Force itemized deductions' }]} />
      <CheckInput id="spouseMustItemize" label="My spouse is itemizing, so I must itemize." checked={draft.deductions.spouseMustItemize} onChange={(spouseMustItemize) => update({ deductions: { ...draft.deductions, spouseMustItemize } })} />
      {['medical', 'stateLocalIncomeOrSales', 'realEstate', 'personalProperty', 'mortgageInterest', 'charityCash', 'charityNoncash'].map((key) => (
        <MoneyInput key={key} id={key} label={labelize(key)} value={draft.deductions[key]} onChange={(value) => update({ deductions: { ...draft.deductions, [key]: value } })} />
      ))}
    </div>
  )
  if (step === 'credits') return (
    <div className="stack">
      <p>{stepHint('credits')}</p>
      <CheckInput id="claimCtc" label="Claim the child tax credit for qualifying children under 17." checked={draft.credits.claimCtc} onChange={(claimCtc) => update({ credits: { ...draft.credits, claimCtc } })} />
      <CheckInput id="ssnAttested" label="I understand a filing provider must validate the required Social Security numbers. This sandbox cannot." checked={draft.credits.ssnAttested} onChange={(ssnAttested) => update({ credits: { ...draft.credits, ssnAttested } })} />
      <CheckInput id="claimEitc" label="Claim the earned income credit if the loaded tests pass." checked={draft.credits.claimEitc} onChange={(claimEitc) => update({ credits: { ...draft.credits, claimEitc } })} />
      <CheckInput id="separatedSpouseEitc" label="I meet the special separated-spouse EITC rule." checked={draft.credits.separatedSpouseEitc} onChange={(separatedSpouseEitc) => update({ credits: { ...draft.credits, separatedSpouseEitc } })} />
      <CheckInput id="claimEducation" label="Claim an education credit for one student." checked={draft.credits.claimEducation} onChange={(claimEducation) => update({ credits: { ...draft.credits, claimEducation } })} />
      <SelectInput id="educationType" label="Education credit" value={draft.credits.educationType} onChange={(educationType) => update({ credits: { ...draft.credits, educationType } })} options={[{ value: 'aotc', label: 'American opportunity' }, { value: 'llc', label: 'Lifetime learning' }]} />
      <MoneyInput id="educationExpenses" label="Qualified education expenses" value={draft.credits.educationExpenses} onChange={(educationExpenses) => update({ credits: { ...draft.credits, educationExpenses } })} />
      <CheckInput id="educationHalfTime" label="The student was enrolled at least half time." checked={draft.credits.educationHalfTime} onChange={(educationHalfTime) => update({ credits: { ...draft.credits, educationHalfTime } })} />
    </div>
  )
  if (step === 'taxes') return <CalcLines result={result} note="Self-employment tax, additional Medicare tax, and net investment income tax update from the income already entered." />
  if (step === 'payments') return (
    <div className="stack">
      <MoneyInput id="estimatedFederal" label="Federal estimated tax payments" value={draft.payments.estimatedFederal} onChange={(estimatedFederal) => update({ payments: { ...draft.payments, estimatedFederal } })} />
      <MoneyInput id="estimatedState" label="State estimated tax payments" value={draft.payments.estimatedState} onChange={(estimatedState) => update({ payments: { ...draft.payments, estimatedState } })} />
      <p className="muted">Withholding stays on the income items so it is not entered twice.</p>
    </div>
  )
  if (step === 'federal' || step === 'calculations') return <CalcLines result={result} />
  if (step === 'state') return (
    <div className="stack">
      <CheckInput id="prepare" label="Prepare the state return when this version supports it." checked={draft.stateReturn.prepare} onChange={(prepare) => update({ stateReturn: { ...draft.stateReturn, prepare } })} />
      <CheckInput id="acknowledgeFederalOnly" label="I only want a federal estimate if my state is not supported." checked={draft.stateReturn.acknowledgeFederalOnly} onChange={(acknowledgeFederalOnly) => update({ stateReturn: { ...draft.stateReturn, acknowledgeFederalOnly } })} />
      <MoneyInput id="additions" label="State additions you have already classified" value={draft.stateReturn.additions} onChange={(additions) => update({ stateReturn: { ...draft.stateReturn, additions } })} />
      <MoneyInput id="subtractions" label="Other state subtractions you have already classified" value={draft.stateReturn.subtractions} onChange={(subtractions) => update({ stateReturn: { ...draft.stateReturn, subtractions } })} />
      {result?.state ? <Notice>{result.state.message}</Notice> : null}
    </div>
  )
  if (step === 'validate') return <Findings draft={draft} />
  if (step === 'fees') return <Fees draft={draft} update={update} />
  if (step === 'signature') return (
    <div className="stack">
      <CheckInput id="authorization" label="I authorize this application to hold the return for a future configured filing provider. This is not an IRS submission." checked={draft.signature.authorization} onChange={(authorization) => update({ signature: { ...draft.signature, authorization } })} />
      <TextInput id="signatureName" label="Type your full name" value={draft.signature.name} onChange={(name) => update({ signature: { ...draft.signature, name, accepted: true } })} />
    </div>
  )
  if (step === 'submit') return <SubmitPanel draft={draft} />
  if (step === 'result' || step === 'track') return <ResultPanel draft={draft} />
  return null
}

function PersonFields({ person, onChange, prefix }) {
  return (
    <div className="stack">
      <TextInput id={`${prefix}-first`} label="First name" value={person.firstName} onChange={(firstName) => onChange({ ...person, firstName })} />
      <TextInput id={`${prefix}-last`} label="Last name" value={person.lastName} onChange={(lastName) => onChange({ ...person, lastName })} />
      <TextInput id={`${prefix}-dob`} label="Date of birth" type="date" value={person.dateOfBirth} onChange={(dateOfBirth) => onChange({ ...person, dateOfBirth })} />
      <TextInput id={`${prefix}-tin`} label="Optional last four digits" value={person.tinLast4} onChange={(tinLast4) => onChange({ ...person, tinLast4 })} hint="Do not enter a real Social Security number." />
      <CheckInput id={`${prefix}-blind`} label="Legally blind at the end of 2025." checked={person.blind} onChange={(blind) => onChange({ ...person, blind })} />
      <CheckInput id={`${prefix}-dependent`} label="Someone else can claim me as a dependent." checked={person.claimedAsDependent} onChange={(claimedAsDependent) => onChange({ ...person, claimedAsDependent })} />
    </div>
  )
}

function Dependents({ draft, update }) {
  function change(index, patch) {
    const dependents = draft.dependents.map((dependent, item) => item === index ? { ...dependent, ...patch } : dependent)
    update({ dependents })
  }
  return (
    <div className="stack">
      {draft.dependents.map((dependent, index) => (
        <fieldset key={dependent.id} className="card">
          <legend>Dependent {index + 1}</legend>
          <TextInput id={`dep-first-${index}`} label="First name" value={dependent.firstName} onChange={(firstName) => change(index, { firstName })} />
          <TextInput id={`dep-last-${index}`} label="Last name" value={dependent.lastName} onChange={(lastName) => change(index, { lastName })} />
          <TextInput id={`dep-dob-${index}`} label="Date of birth" type="date" value={dependent.dateOfBirth} onChange={(dateOfBirth) => change(index, { dateOfBirth })} />
          <TextInput id={`dep-rel-${index}`} label="Relationship" value={dependent.relationship} onChange={(relationship) => change(index, { relationship })} />
          <MoneyInput id={`dep-months-${index}`} label="Months lived with you" value={dependent.monthsLived} onChange={(monthsLived) => change(index, { monthsLived })} />
          <CheckInput id={`dep-student-${index}`} label="Full-time student" checked={dependent.student} onChange={(student) => change(index, { student })} />
          <CheckInput id={`dep-disabled-${index}`} label="Permanently and totally disabled" checked={dependent.disabled} onChange={(disabled) => change(index, { disabled })} />
          <button className="btn btn-secondary" type="button" onClick={() => update({ dependents: draft.dependents.filter((item) => item.id !== dependent.id) })}>Remove dependent</button>
        </fieldset>
      ))}
      <button className="btn btn-secondary" type="button" onClick={() => update({ dependents: [...draft.dependents, createDependent()] })}>Add dependent</button>
    </div>
  )
}

function IncomeEditor({ draft, update, returnId, backend }) {
  const [type, setType] = useState('w2')
  function add() { update({ incomeItems: [...draft.incomeItems, createIncomeItem(type)] }) }
  function change(id, patch) {
    update({ incomeItems: draft.incomeItems.map((item) => item.id === id ? { ...item, ...patch } : item) })
  }
  async function onFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const saved = await backend.saveReturn(returnId, draft)
    if (!saved.ok) return
    const added = await backend.addDocument(returnId, file)
    if (added.ok) update(added.return)
  }
  return (
    <div className="stack">
      <div className="row">
        <SelectInput id="income-type" label="Add income" value={type} onChange={setType} options={INCOME_TYPES.map((item) => ({ value: item.id, label: item.label }))} />
        <button className="btn btn-secondary" type="button" onClick={add}>Add income</button>
      </div>
      {draft.incomeItems.map((item) => <IncomeCard key={item.id} item={item} onChange={(patch) => change(item.id, patch)} onDelete={() => update({ incomeItems: draft.incomeItems.filter((entry) => entry.id !== item.id) })} />)}
      <label className="field" htmlFor="upload"><span>Attach a PDF or image</span>
        <input id="upload" type="file" accept="application/pdf,image/png,image/jpeg" onChange={onFile} />
      </label>
      <ul>{(draft.documents || []).map((document) => <li key={document.id}>{document.name} — {document.extraction.message} <button type="button" onClick={() => { const removed = backend.deleteDocument(returnId, document.id); if (removed.ok) update(removed.return) }}>Delete</button></li>)}</ul>
    </div>
  )
}

function IncomeCard({ item, onChange, onDelete }) {
  const amount = (id, label, key) => <MoneyInput id={`${item.id}-${id}`} label={label} value={item[key]} onChange={(value) => onChange({ [key]: value })} />
  return (
    <fieldset className="card">
      <legend>{item.type}</legend>
      <TextInput id={`${item.id}-payer`} label="Payer or description" value={item.payerName || item.description} onChange={(payerName) => onChange({ payerName, description: payerName })} />
      {item.type === 'w2' ? <>{amount('wages', 'Wages', 'wages')}{amount('withholding', 'Federal withholding', 'federalWithholding')}{amount('state-withholding', 'State withholding', 'stateWithholding')}</> : null}
      {item.type === '1099-int' ? amount('interest', 'Interest', 'interest') : null}
      {item.type === '1099-div' ? <>{amount('ordinary', 'Ordinary dividends', 'ordinaryDividends')}{amount('qualified', 'Qualified dividends', 'qualifiedDividends')}</> : null}
      {item.type === '1099-nec' ? <>{amount('comp', 'Nonemployee compensation', 'compensation')}{amount('exp', 'Expenses', 'expenses')}</> : null}
      {item.type === 'schedule-c' ? <>{amount('gross', 'Gross receipts', 'grossReceipts')}{amount('exp', 'Expenses', 'expenses')}</> : null}
      {item.type === '1099-r' ? amount('taxable', 'Taxable amount', 'taxableAmount') : null}
      {item.type === 'unemployment' || item.type === 'other' ? amount('amount', 'Amount', 'amount') : null}
      {item.type === 'schedule-e' ? <>{amount('rents', 'Rents', 'rents')}{amount('exp', 'Expenses', 'expenses')}</> : null}
      {item.type === 'capital-gain' ? <>{amount('proceeds', 'Proceeds', 'proceeds')}{amount('basis', 'Basis', 'basis')}</> : null}
      {item.type === 'social-security' ? amount('taxable-ss', 'Taxable amount from the Social Security worksheet', 'taxableAmount') : null}
      <button className="btn btn-secondary" type="button" onClick={onDelete}>Delete income</button>
    </fieldset>
  )
}

function CalcLines({ result, note }) {
  if (!result) return <Notice>Choose a filing status and save to calculate.</Notice>
  const rows = [
    ['Total income', result.grossIncome],
    ['Adjustments', result.adjustments.total],
    ['Adjusted gross income', result.agi],
    ['Deduction', result.deduction.amount],
    ['Taxable income', result.taxableIncome],
    ['Income tax', result.incomeTax.tax],
    ['Other taxes', result.totalTaxBeforeCredits - result.incomeTax.tax],
    ['Credits', result.credits.nonrefundable],
    ['Payments and refundable credits', result.payments + result.credits.refundable],
    ['Estimated refund', result.refund],
    ['Estimated amount due', result.amountDue],
  ]
  return (
    <div className="stack">
      <Notice>{result.estimateNotice}</Notice>
      {note ? <p>{note}</p> : null}
      <div className="table-wrap" tabIndex={0} aria-label="Calculation breakdown">
        <table className="table">
          <tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td><Money value={value} /></td></tr>)}</tbody>
        </table>
      </div>
      {result.limitations.map((item) => <Notice tone="warn" key={item}>{item}</Notice>)}
    </div>
  )
}

function Findings({ draft }) {
  const findings = draft.validation || { errors: [], warnings: [], info: [] }
  const groups = [['Errors', findings.errors], ['Warnings', findings.warnings], ['Notes', findings.info]]
  return (
    <div className="stack">
      {groups.map(([label, items]) => (
        <section key={label}>
          <h2>{label}</h2>
          {items.length ? <ul>{items.map((item) => <li key={`${item.code}-${item.message}`}><Link to={`/returns/${draft.id}/${item.step || 'validate'}`}>{item.message}</Link></li>)}</ul> : <p>None.</p>}
        </section>
      ))}
    </div>
  )
}

function Fees({ draft, update }) {
  const { backend } = useApp()
  const [payment, setPayment] = useState(draft.payment)
  async function checkout() {
    const saved = await backend.saveReturn(draft.id, { ...draft, productId: draft.productId })
    if (!saved.ok) return
    const result = await backend.createCheckout(draft.id)
    if (result.ok) { setPayment(result.payment); update(result.return) }
  }
  return (
    <div className="stack">
      {Object.values(PRODUCTS).map((product) => (
        <label key={product.id} className="check"><input type="radio" name="product" checked={draft.productId === product.id} onChange={() => update({ productId: product.id })} /> <span><strong>{product.name}</strong> — {product.summary}</span></label>
      ))}
      <button className="btn btn-primary" type="button" onClick={checkout}>Review unpaid checkout</button>
      {payment ? <Notice>{payment.message} Status: {payment.status}.</Notice> : null}
    </div>
  )
}

function SubmitPanel({ draft }) {
  const { backend } = useApp()
  const [filing, setFiling] = useState(draft.filing)
  const [error, setError] = useState('')
  async function submit() {
    const saved = await backend.saveReturn(draft.id, draft)
    if (!saved.ok) { setError(saved.error.message); return }
    const result = await backend.submitFiling(draft.id)
    if (!result.ok) { setError(result.error.message); return }
    setFiling(result.filing)
    setError('')
  }
  return (
    <div className="stack">
      <p>Submission uses the sandbox adapter. It does not contact the IRS.</p>
      <button className="btn btn-primary" type="button" onClick={submit}>Run sandbox check</button>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {filing ? <Notice data-testid="filing-result">{filing.message}</Notice> : null}
    </div>
  )
}

function ResultPanel({ draft }) {
  const filing = draft.filing
  return (
    <div className="stack">
      <h2>Result</h2>
      {filing ? <Notice>{filing.environment} · submitted: {String(filing.submitted)} · accepted: {String(filing.accepted)} · id: {filing.submissionId === null ? 'none' : filing.submissionId}</Notice> : <Notice>No sandbox result yet.</Notice>}
      <CalcLines result={draft.calculation?.result} />
    </div>
  )
}

function HelpBox({ step }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  async function ask(event) {
    event.preventDefault()
    setAnswer(await answerTaxQuestion({ question, step, apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '' }))
  }
  return (
    <form className="help-box" onSubmit={ask}>
      <h2>Guided help</h2>
      <p>{stepHint(step)}</p>
      <TextInput id="help-question" label="Ask about a term" value={question} onChange={setQuestion} />
      <button className="btn btn-secondary" type="submit">Ask</button>
      {answer ? <Notice><strong>{answer.title}. </strong>{answer.answer} {answer.href ? <a href={answer.href}>Official source</a> : null}</Notice> : null}
    </form>
  )
}

export function Summary() {
  const { id } = useParams()
  const { backend } = useApp()
  const loaded = backend.getReturn(id)
  if (!loaded.ok) return <Notice tone="error">That return is not available.</Notice>
  const lines = loaded.return.calculation?.result?.forms?.form1040?.lines || []
  function download() {
    const text = ['XPRESSTAX UNOFFICIAL ESTIMATE', 'Not an IRS form. Not a filed return.', ...lines.map((line) => `${line.label}: ${line.amount}`)].join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'xpresstax-unofficial-estimate.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="print-sheet stack">
      <h1>Unofficial estimate</h1>
      <p>This preview is not an IRS form and it is not a filing confirmation.</p>
      <CalcLines result={loaded.return.calculation?.result} />
      <button className="btn btn-secondary" type="button" onClick={download}>Download text summary</button>
      <button className="btn btn-secondary" type="button" onClick={() => window.print()}>Print</button>
    </section>
  )
}

function labelize(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}
