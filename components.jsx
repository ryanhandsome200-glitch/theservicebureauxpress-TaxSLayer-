import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { formatMoney } from './format.js'

const APP_NAME = import.meta.env.VITE_APP_NAME || 'theservicebureauxpress TaxSLayer'

export function Brand() {
  return (
    <Link className="brand" to="/">{APP_NAME}</Link>
  )
}

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <header className="site-header">
      <Brand />
      <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((value) => !value)}>
        {open ? 'Close' : 'Menu'}
      </button>
      <nav id="site-nav" className={open ? 'nav open' : 'nav'} aria-label="Primary">
        <NavLink to="/product" onClick={close}>Product</NavLink>
        <NavLink to="/pricing" onClick={close}>Pricing</NavLink>
        <NavLink to="/how-it-works" onClick={close}>How it works</NavLink>
        <NavLink to="/situations" onClick={close}>Forms</NavLink>
        <NavLink to="/help" onClick={close}>Help</NavLink>
        <Link className="btn btn-secondary" to="/login" onClick={close}>Log in</Link>
        <Link className="btn btn-primary" to="/signup" onClick={close}>Start a return</Link>
      </nav>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="footer">
      <div>
        <strong>{APP_NAME}</strong>
        <p>An independent tax-preparation application. It is not affiliated with any other commercial tax brand or with the IRS.</p>
      </div>
      <nav aria-label="Footer">
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/security">Security</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </nav>
      <p className="muted">Tax year 2025 rules are loaded. Figures are estimates until a configured filing provider accepts a return. Not every tax situation is supported. Photographs are from Unsplash.</p>
    </footer>
  )
}

export function PageHero({ kicker, title, lede, actions, image, imageAlt }) {
  return (
    <section className={image ? 'hero hero-photo' : 'hero'}>
      {image ? <img className="hero-media" src={image} alt={imageAlt || ''} /> : null}
      <div className="hero-copy">
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
    </section>
  )
}

export function Notice({ tone = 'info', children, ...rest }) {
  return <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'} {...rest}>{children}</p>
}

export function Field({ label, children, error, hint, id }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
      {error ? <small className="error-text" id={`${id}-error`}>{error}</small> : null}
    </div>
  )
}

export function TextInput({ id, label, value, onChange, type = 'text', autoComplete, error, hint }) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input id={id} name={id} type={type} value={value} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

export function MoneyInput({ id, label, value, onChange, hint }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <input id={id} name={id} inputMode="decimal" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />
    </Field>
  )
}

export function SelectInput({ id, label, value, onChange, options, hint }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <select id={id} name={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  )
}

export function CheckInput({ id, label, checked, onChange }) {
  return (
    <label className="check" htmlFor={id}>
      <input id={id} name={id} type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Money({ value }) {
  return <span className="money">{formatMoney(value || 0)}</span>
}

export function Shell({ user, onLogout, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <aside className={open ? 'rail open' : 'rail'}>
        <Brand />
        <nav aria-label="Workspace">
          <NavLink to="/dashboard" onClick={() => setOpen(false)}>Dashboard</NavLink>
          <NavLink to="/account" onClick={() => setOpen(false)}>Account</NavLink>
          <NavLink to="/help" onClick={() => setOpen(false)}>Help</NavLink>
          {user && user.role !== 'taxpayer' ? <NavLink to="/admin" onClick={() => setOpen(false)}>Administration</NavLink> : null}
        </nav>
        <button className="btn btn-secondary" type="button" onClick={onLogout}>Log out</button>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <button className="nav-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Menu</button>
          <p className="muted">Development sandbox. Do not enter real Social Security numbers or account numbers.</p>
        </div>
        <div id="main">{children}</div>
      </div>
    </div>
  )
}
