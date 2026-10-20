import { useState } from 'react'
import { Notice } from './components.jsx'
import { useApp } from './store.jsx'
import { listTaxYears } from './tax-rules.js'

export function Admin() {
  const { backend, user } = useApp()
  const [message, setMessage] = useState('')
  if (!user || user.role === 'taxpayer') return <Notice tone="error">You do not have access to administration.</Notice>
  let metrics = null
  let users = []
  let returns = []
  let payments = []
  let tickets = []
  let audit = []
  let flags = {}
  try {
    if (user.role === 'admin' || user.role === 'rules_admin') metrics = backend.adminMetrics()
    if (user.role === 'admin') users = backend.adminListUsers()
    if (user.role === 'admin' || user.role === 'rules_admin') returns = backend.adminListReturns()
    if (user.role === 'admin' || user.role === 'support') {
      payments = backend.adminListPayments()
      tickets = backend.adminListTickets()
    }
    if (user.role === 'admin') audit = backend.adminAudit()
    if (user.role === 'admin' || user.role === 'rules_admin') flags = backend.adminFlags()
  } catch (error) {
    return <Notice tone="error">{error.message}</Notice>
  }
  return (
    <section className="stack">
      <h1>Administration</h1>
      <p className="muted">Summaries are redacted. Full taxpayer identification numbers and document contents are not shown.</p>
      {metrics ? <div className="cards">{Object.entries(metrics).map(([key, value]) => <article key={key} className="card"><h2>{key}</h2><p>{value}</p></article>)}</div> : null}
      <h2>Filing integration</h2>
      <p>Provider configured: no. Sandbox filing: {String(flags.sandboxFilingEnabled)}. Production submission is disabled.</p>
      <h2>Tax rules</h2>
      <ul>{listTaxYears().map((year) => <li key={year.taxYear}>{year.taxYear} · {year.version} · {year.overallStatus} · reviewed {year.lastReviewed}</li>)}</ul>
      <h2>Feature flags</h2>
      {Object.entries(flags).map(([name, value]) => <button key={name} className="btn btn-secondary" type="button" onClick={() => { const result = backend.adminSetFlag(name, !value); setMessage(result.ok ? `${name} is ${result.flags[name]}` : result.error.message) }}>{name}: {String(value)}</button>)}
      <h2>Users</h2>
      <ul>{users.map((item) => <li key={item.id}>{item.name || 'Unnamed'} · {item.role}</li>)}</ul>
      <h2>Return summaries</h2>
      <ul>{returns.map((item) => <li key={item.id}>{item.taxYear} · {item.status} · {item.residentState}</li>)}</ul>
      <h2>Payments</h2>
      <ul>{payments.map((item) => <li key={item.returnId}>{item.status} · verified {String(item.verified)} · paid {String(item.paid)}</li>)}</ul>
      <h2>Support tickets</h2>
      <ul>{tickets.map((ticket) => <li key={ticket.id}>{ticket.subject} · {ticket.status} <button type="button" onClick={() => backend.adminUpdateTicket(ticket.id, ticket.status === 'open' ? 'closed' : 'open')}>Toggle</button></li>)}</ul>
      <h2>Audit</h2>
      <ul>{audit.slice(-8).map((event) => <li key={event.id}>{event.action} · {event.entityType}</li>)}</ul>
      {message ? <Notice>{message}</Notice> : null}
    </section>
  )
}
