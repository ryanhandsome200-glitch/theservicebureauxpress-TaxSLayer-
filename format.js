export function dollarsToCents(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('Invalid dollar amount')
  const sign = n < 0 ? -1 : 1
  const [whole, frac] = Math.abs(n).toFixed(2).split('.')
  return sign * (Number(whole) * 100 + Number(frac))
}

export function roundToDollars(cents) {
  if (!Number.isFinite(cents)) throw new Error('Invalid cent amount')
  const sign = cents < 0 ? -1 : 1
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100)
  const rem = abs % 100
  return sign * (rem >= 50 ? whole + 1 : whole)
}

export function applyRate(cents, rate) {
  const bps = Math.round(rate * 10000)
  return Math.round(cents * bps / 10000)
}

export function formatMoney(dollars) {
  const n = Number(dollars)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function formatPercent(rate) {
  return `${(rate * 100).toFixed(2).replace(/\.00$/, '')}%`
}
