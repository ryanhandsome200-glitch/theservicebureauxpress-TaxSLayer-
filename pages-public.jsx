import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice, PageHero, PublicFooter, PublicHeader } from './components.jsx'
import { PRODUCTS, quoteFees, recommendedProduct } from './tax-rules.js'
import { useApp } from './store.jsx'
import { formatMoney } from './format.js'
import mascot from './media-mascot.png'
import documentsPhoto from './media-documents.jpg'
import supportPhoto from './media-support.jpg'

const FAQS = [
  { q: 'Which tax year can I prepare?', a: 'This version loads tax year 2025 only. Other years are refused so rules from different years are not mixed.' },
  { q: 'Does starting a return file it?', a: 'No. A return stays an estimate until a configured e-file provider accepts it. The sandbox never creates an acceptance or a submission ID.' },
  { q: 'Which states are calculated?', a: 'Full-year California and Illinois residents have limited calculations. Every other state is identified as unsupported.' },
  { q: 'Are the worksheets official IRS forms?', a: 'No. Downloads and print views are unofficial summaries. They are not forms you can file by themselves.' },
  { q: 'Where is my data stored?', a: 'In the development sandbox, a return stays in memory for the browser session. It is not written to local storage. Production requires a separate secure API.' },
  { q: 'Can the help panel change my return?', a: 'No. Guided help can explain a term. It cannot change a calculation or submit a return.' },
]

export function PublicLayout({ children }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <PublicHeader />
      <main id="main">{children}</main>
      <PublicFooter />
    </>
  )
}

const PRICE_ORDER = ['essential', 'standard', 'household', 'selfEmployed']

export function PriceBoard() {
  return (
    <section className="price-row" aria-label="Preparation options">
      {PRICE_ORDER.map((id) => {
        const product = PRODUCTS[id]
        return (
          <article key={id} className={id === 'household' ? 'price-card featured' : 'price-card'}>
            <p className="price-flag">{id === 'household' ? 'Wider return' : '2025 preparation'}</p>
            <h2>{product.name}</h2>
            <p className="price-amount">{formatMoney(product.federalFee)} <span>federal</span></p>
            <p>{formatMoney(product.stateFee)} when a supported state return is prepared.</p>
            <p>{product.summary}</p>
            <Link className="btn btn-primary" to="/signup">Choose {product.name}</Link>
          </article>
        )
      })}
    </section>
  )
}

export function Home() {
  return (
    <PublicLayout>
      <section className="home-banner">
        <div className="home-banner-grid">
          <div className="hero-copy">
            <p className="kicker">Tax year 2025</p>
            <h1>Your return, set out in a straight line.</h1>
            <p className="lede">Wages, deductions, credits, and a state estimate when this version supports it. Nothing on this page files a return.</p>
            <div className="actions">
              <Link className="btn btn-primary" to="/signup">Start a return</Link>
              <Link className="btn btn-secondary" to="/how-it-works">See the path</Link>
            </div>
          </div>
          <img className="banner-mascot" src={`${mascot}?v=20261020e`} alt="A teal bird holding a blank sheet of paper" />
        </div>
      </section>
      <PriceBoard />
      <section className="section media-band">
        <figure>
          <img src={`${documentsPhoto}?v=20261020c`} alt="Hands holding a tax form beside a calculator, coffee, and a laptop" />
          <figcaption>Income is entered from the form in front of you.</figcaption>
        </figure>
        <figure>
          <img src={`${supportPhoto}?v=20261020c`} alt="Two people talking at a sunlit table" />
          <figcaption>Help explains a step. It does not change the return.</figcaption>
        </figure>
      </section>
      <section className="section">
        <h2>Four moves, then a review.</h2>
        <ol className="steps">
          <li><strong>Set the facts.</strong><span>Year, people, residency, and filing status.</span></li>
          <li><strong>Enter the documents.</strong><span>W-2s, 1099s, and business or investment items, by hand unless an extractor is configured.</span></li>
          <li><strong>Compare the tax.</strong><span>Deductions, credits, and a line-by-line estimate you can trace.</span></li>
          <li><strong>Stop at the boundary.</strong><span>Fees, authorization, and a sandbox result that is not an IRS acceptance.</span></li>
        </ol>
      </section>
      <section className="section split">
        <div>
          <h2>What this version will calculate.</h2>
          <p>Ordinary wage and investment returns, Schedule C profit, self-employment tax, a limited itemized deduction, the child tax credit, the earned income credit, and full-year California or Illinois estimates.</p>
        </div>
        <div>
          <h2>What it will not pretend to finish.</h2>
          <p>Alternative minimum tax, the premium tax credit, dependent care, passive-loss allowances, and every state. Those limits stay visible in the review.</p>
        </div>
      </section>
      <section className="section">
        <h2>Preparation options stay separate from the tax.</h2>
        <p><Link to="/pricing">Review pricing</Link> before you create an account. The fee is a software charge, not a change to the tax estimate.</p>
      </section>
    </PublicLayout>
  )
}

export function Product() {
  return (
    <PublicLayout>
      <PageHero kicker="Product" title="A guided return, with the limits in writing." lede="The workspace follows the same path a filer expects: people, income, adjustments, deductions, credits, state, review, and a submission boundary." image={`${documentsPhoto}?v=20261020c`} imageAlt="Hands holding a tax form beside a calculator and a laptop" />
      <section className="section">
        <ul className="plain">
          <li>Dashboard progress comes from the open return, not from a sample percentage.</li>
          <li>Extracted document values are never applied until you confirm them. No extractor is connected in this build.</li>
          <li>Administration is role-based and does not show full taxpayer identification numbers.</li>
        </ul>
      </section>
    </PublicLayout>
  )
}

export function Pricing() {
  return (
    <PublicLayout>
      <PageHero kicker="Pricing" title="Federal and state preparation fees." lede="Essential stays at no charge when the return fits its limits. Standard, Household, and Self-Employed add the broader forms. A state fee applies only when a supported state return is prepared." />
      <PriceBoard />
      <section className="section">
        <div className="table-wrap" tabIndex={0} aria-label="Preparation fees">
          <table className="table">
            <thead><tr><th>Option</th><th>Federal</th><th>Supported state</th><th>Fits</th></tr></thead>
            <tbody>
              {Object.values(PRODUCTS).map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{formatMoney(product.federalFee)}</td>
                  <td>{formatMoney(product.stateFee)}</td>
                  <td>{product.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">Card numbers are never stored here. Without a payment provider, checkout stays unpaid.</p>
      </section>
    </PublicLayout>
  )
}

export function HowItWorks() {
  return (
    <PublicLayout>
      <PageHero kicker="How it works" title="You can leave a step and come back." lede="Each step saves into the session return. Refreshing the browser clears the development sandbox, and the screen says so before you rely on it." image={`${supportPhoto}?v=20261020c`} imageAlt="Two people talking at a sunlit table" />
      <section className="section">
        <ol className="steps">
          <li><strong>Create an account.</strong><span>The sandbox shows a verification code because no email provider is configured.</span></li>
          <li><strong>Answer the filing questions.</strong><span>Later questions change when you are married, have dependents, or choose a state.</span></li>
          <li><strong>Review the blockers.</strong><span>Critical errors link back to the step that owns them and stop submission.</span></li>
          <li><strong>Read the result literally.</strong><span>A sandbox result says the return was not transmitted.</span></li>
        </ol>
      </section>
    </PublicLayout>
  )
}

const PAPERS = [
  { id: 'w2', name: 'W-2', bring: 'Wages, federal income tax withheld, and state wages and withholding.', income: 'w2' },
  { id: 'int', name: '1099-INT', bring: 'Interest income and any federal tax withheld.', income: '1099-int' },
  { id: 'div', name: '1099-DIV', bring: 'Ordinary dividends and qualified dividends.', income: '1099-div' },
  { id: 'ret', name: '1099-R', bring: 'Gross distribution and the taxable amount.', income: '1099-r' },
  { id: 'sale', name: 'Broker 1099-B', bring: 'Sale proceeds and what you paid. Wash sales stay out of this estimate.', income: 'capital-gain' },
  { id: 'rent', name: 'Rental records', bring: 'Rent received and expenses you paid. A rental loss stays out of this estimate.', income: 'schedule-e' },
  { id: 'nec', name: '1099-NEC or business records', bring: 'Gross receipts and expenses. Depreciation, vehicle tables, and the home-office deduction stay out of this estimate.', income: '1099-nec' },
  { id: 'deps', name: 'Dependent information', bring: 'Each dependent’s relationship and the months they lived with you.', dependents: true },
  { id: 'item', name: 'Deduction receipts', bring: 'Medical bills, state taxes paid, mortgage interest, and gifts. The return compares them with the standard deduction.', itemized: true },
  { id: 'school', name: '1098-T', bring: 'Tuition paid for one student.', note: 'Confirm the education credit on the 2025 form before you rely on the figure.' },
  { id: 'care', name: 'Child-care statement', bring: 'Provider name and the amount you paid.', note: 'The child and dependent care credit stays out of this estimate.' },
  { id: 'market', name: 'Form 1095-A', bring: 'Marketplace coverage and the advance payment.', note: 'The premium tax credit stays out of this estimate.' },
]

function papersRecord(picked, filingStatus) {
  return {
    filingStatus,
    incomeItems: PAPERS.filter((paper) => picked[paper.id] && paper.income).map((paper) => ({ type: paper.income })),
    dependents: picked.deps ? [{}] : [],
    deductions: { choice: picked.item ? 'itemized' : 'standard' },
  }
}

export function Situations() {
  const [picked, setPicked] = useState({})
  const [filingStatus, setFilingStatus] = useState('single')
  const [stateCode, setStateCode] = useState('')
  const chosen = PAPERS.filter((paper) => picked[paper.id])
  const product = PRODUCTS[recommendedProduct(papersRecord(picked, filingStatus))]
  const statePrepared = stateCode === 'CA' || stateCode === 'IL'
  const fees = quoteFees(product.id, statePrepared)
  const stateName = stateCode === 'CA' ? 'California' : 'Illinois'
  return (
    <PublicLayout>
      <PageHero kicker="Forms" title="Check the papers in front of you." lede="Each box is a document you can type into a 2025 return. The panel names the preparation option that covers that set and the fee for it." />
      <section className="section split">
        <form className="stack" onSubmit={(event) => event.preventDefault()}>
          <label className="field" htmlFor="paper-status"><span>Filing status</span>
            <select id="paper-status" value={filingStatus} onChange={(event) => setFilingStatus(event.target.value)}>
              <option value="single">Single</option>
              <option value="mfj">Married filing jointly</option>
              <option value="mfs">Married filing separately</option>
              <option value="hoh">Head of household</option>
              <option value="qss">Qualifying surviving spouse</option>
            </select>
          </label>
          <label className="field" htmlFor="paper-state"><span>State return</span>
            <select id="paper-state" value={stateCode} onChange={(event) => setStateCode(event.target.value)}>
              <option value="">No state return</option>
              <option value="CA">California, full year</option>
              <option value="IL">Illinois, full year</option>
              <option value="other">Another state</option>
            </select>
          </label>
          <div className="paper-grid">
            {PAPERS.map((paper) => (
              <label key={paper.id}>
                <input type="checkbox" checked={Boolean(picked[paper.id])} onChange={() => setPicked((current) => ({ ...current, [paper.id]: !current[paper.id] }))} />
                <span><strong>{paper.name}</strong></span>
              </label>
            ))}
          </div>
        </form>
        <aside className="card pick-result">
          <p className="kicker">Preparation option</p>
          <h2>{product.name}</h2>
          <p className="price-amount">{formatMoney(fees.total)} <span>to prepare</span></p>
          <p>{formatMoney(fees.federalFee)} federal{statePrepared ? `, plus ${formatMoney(fees.stateFee)} for a full-year ${stateName} estimate.` : '.'}</p>
          {stateCode === 'other' ? <p>Full-year California and Illinois are the state estimates in this version. Another state is identified and left uncalculated.</p> : null}
          {chosen.length ? (
            <ul className="plain">
              {chosen.map((paper) => <li key={paper.id}><strong>{paper.name}.</strong> {paper.bring} {paper.note || ''}</li>)}
            </ul>
          ) : <p>Wages and the standard deduction fit Essential. Add a paper when you have it.</p>}
          <Link className="btn btn-primary" to="/signup">Start a return with {product.name}</Link>
        </aside>
      </section>
    </PublicLayout>
  )
}

export function Help() {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => FAQS.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(query.toLowerCase())), [query])
  return (
    <PublicLayout>
      <PageHero kicker="Help" title="Search the questions this version can answer." lede="If a topic is not listed, the filing workspace will say that it needs a person or IRS guidance rather than inventing a rule." />
      <section className="section">
        <label className="field" htmlFor="faq-search"><span>Search help</span>
          <input id="faq-search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {matches.length ? (
          <div className="faq">
            {matches.map((item) => <article key={item.q}><h2>{item.q}</h2><p>{item.a}</p></article>)}
          </div>
        ) : <Notice>No matching article. Try a broader word, or contact support.</Notice>}
      </section>
    </PublicLayout>
  )
}

export function About() {
  return (
    <PublicLayout>
      <PageHero kicker="About" title="Built as an independent filing workspace." lede="theservicebureauxpress is an independent preparation workspace. Company formation, a staffed support line, and legal review are still outstanding and are labeled that way." />
      <section className="section"><p>The calculation sources are the IRS revenue procedures, form instructions, the California Franchise Tax Board, and the Illinois Department of Revenue cited inside the tax-rules registry.</p></section>
    </PublicLayout>
  )
}

export function Contact() {
  const { backend, user } = useApp()
  const [form, setForm] = useState({ subject: '', message: '', email: user?.email || '' })
  const [result, setResult] = useState(null)
  function submit(event) {
    event.preventDefault()
    setResult(backend.createTicket(form))
  }
  return (
    <PublicLayout>
      <PageHero kicker="Contact" title="Send a support note." lede="There is no staffed phone line in this build. A ticket stays in the session and is not emailed." />
      <section className="section narrow">
        <form onSubmit={submit}>
          <label className="field" htmlFor="subject"><span>Subject</span><input id="subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required /></label>
          <label className="field" htmlFor="message"><span>Message</span><textarea id="message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required /></label>
          <button className="btn btn-primary" type="submit">Store support request</button>
        </form>
        {result?.ok ? <Notice tone="ok">{result.ticket.delivery.message}</Notice> : null}
        {result && !result.ok ? <Notice tone="error">{result.error.message}</Notice> : null}
      </section>
    </PublicLayout>
  )
}

export function Privacy() {
  return (
    <PublicLayout>
      <PageHero kicker="Privacy" title="A placeholder privacy notice." lede="Counsel needs to review this notice before a public launch. It describes the software’s current behavior. It is not a certification." />
      <section className="section legal">
        <p>The development sandbox keeps account and return data in memory. It does not write tax records to browser local storage or session storage. Production is expected to use a separate database with access control, encryption in transit, and encryption at rest.</p>
        <p>Do not enter a real Social Security number, bank account, or card number. The sandbox asks only for an optional last-four test value.</p>
        <p>Account deletion removes that user’s sandbox returns from memory. It cannot promise deletion from a provider that has not been connected.</p>
      </section>
    </PublicLayout>
  )
}

export function Terms() {
  return (
    <PublicLayout>
      <PageHero kicker="Terms" title="A placeholder terms notice." lede="These terms are not a legal agreement. They describe product limits so the software is not mistaken for a filed return." />
      <section className="section legal">
        <p>Estimates can be wrong for situations the engine marks as partial or unsupported. You are responsible for reviewing the return before any future provider transmits it.</p>
        <p>Preparation fees, when a payment provider is connected, are charges for software. They do not change the tax calculation.</p>
      </section>
    </PublicLayout>
  )
}

export function SecurityInfo() {
  return (
    <PublicLayout>
      <PageHero kicker="Security" title="Tax data stays out of the public browser bundle." lede="Secrets, database credentials, and e-file credentials are server configuration. They are not Vite variables." />
      <section className="section legal">
        <ul className="plain">
          <li>Development passwords are hashed in memory and are not a production identity system.</li>
          <li>Sessions expire after 20 idle minutes or 8 hours.</li>
          <li>Repeated login failures lock the sandbox account for 15 minutes.</li>
          <li>Optional authenticator codes use TOTP. No SMS is sent.</li>
          <li>Uploads are limited to PDF, PNG, and JPEG files of 5 MB or less, and only metadata is kept.</li>
        </ul>
      </section>
    </PublicLayout>
  )
}

export function NotFound() {
  return (
    <PublicLayout>
      <PageHero kicker="404" title="That page is not part of theservicebureauxpress." lede="The address may be mistyped. You can return to the start or open the help index." actions={<Link className="btn btn-primary" to="/">Back to the start</Link>} />
    </PublicLayout>
  )
}
