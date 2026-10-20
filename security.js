const TEXT_ENCODER = new TextEncoder()
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export const ROLES = ['taxpayer', 'support', 'admin', 'rules_admin']

const PERMISSIONS = {
  'return.own': ['taxpayer', 'support', 'admin', 'rules_admin'],
  'admin.metrics': ['admin', 'rules_admin'],
  'admin.users': ['admin'],
  'admin.tickets': ['support', 'admin'],
  'admin.rules': ['admin', 'rules_admin'],
  'admin.audit': ['admin'],
  'admin.filing': ['admin'],
  'admin.payments': ['admin', 'support'],
}

export function hasPermission(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role)
}

export function assertPermission(user, permission) {
  if (!user || !hasPermission(user.role, permission)) {
    const error = new Error('You do not have access to that action.')
    error.code = 'FORBIDDEN'
    throw error
  }
}

export function redactText(value) {
  return String(value ?? '')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****')
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[redacted-number]')
}

export function redactRecord(value) {
  if (Array.isArray(value)) return value.map((item) => redactRecord(item))
  if (!value || typeof value !== 'object') return typeof value === 'string' ? redactText(value) : value
  const hidden = /tin|ssn|password|secret|token|content|bytes|dataurl|account/i
  const out = {}
  Object.entries(value).forEach(([key, entry]) => {
    if (hidden.test(key)) out[key] = '[redacted]'
    else out[key] = redactRecord(entry)
  })
  return out
}

export function redactReturnSummary(record) {
  return {
    id: record.id,
    taxYear: record.taxYear,
    status: record.status,
    filingStatus: record.filingStatus || '',
    residentState: record.address?.state || '',
    updatedAt: record.updatedAt,
    refund: record.calculation?.result?.refund ?? null,
    amountDue: record.calculation?.result?.amountDue ?? null,
    taxpayer: initials(record.taxpayer),
  }
}

export function inspectPublicEnv(env) {
  const issues = []
  if (env.PROD && env.VITE_DEV_ALLOW_ADMIN_BOOTSTRAP === 'true') {
    issues.push('Administrator bootstrap is enabled in a production build.')
  }
  if (env.VITE_DATA_MODE === 'production' && !env.VITE_API_BASE_URL) {
    issues.push('Production mode has no API base URL.')
  }
  Object.entries(env).forEach(([key, value]) => {
    if (!key.startsWith('VITE_')) return
    if (/secret|service_role|private_key|password|sk_live/i.test(key)) issues.push(`${key} is not a safe public variable.`)
    if (/sk_live_|service_role|BEGIN PRIVATE KEY/i.test(String(value || ''))) issues.push(`${key} contains a private credential.`)
  })
  return issues
}

export async function hashPassword(password, saltBytes, iterations = 100000) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', TEXT_ENCODER.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt), iterations }
}

export async function verifyPassword(password, stored) {
  const actual = await hashPassword(password, fromBase64(stored.salt), stored.iterations)
  return safeEqual(actual.hash, stored.hash)
}

export function safeEqual(left, right) {
  const a = String(left)
  const b = String(right)
  const length = Math.max(a.length, b.length)
  let mismatch = a.length === b.length ? 0 : 1
  for (let index = 0; index < length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return mismatch === 0
}

export function randomId() {
  return crypto.randomUUID()
}

export function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return String(bytes.reduce((sum, byte) => sum * 256 + byte, 0) % 1000000).padStart(6, '0')
}

export function generateTotpSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return toBase32(bytes)
}

export async function totpCode(secret, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step)
  const data = new Uint8Array(8)
  const view = new DataView(data.buffer)
  view.setUint32(4, counter >>> 0)
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(fromBase32(secret)), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
  const offset = signature[signature.length - 1] & 15
  const binary = ((signature[offset] & 127) << 24) | ((signature[offset + 1] & 255) << 16) | ((signature[offset + 2] & 255) << 8) | (signature[offset + 3] & 255)
  return String(binary % 1000000).padStart(6, '0')
}

export async function verifyTotp(secret, code, time = Date.now()) {
  const normalized = String(code || '').replace(/\s/g, '')
  const matches = await Promise.all([-1, 0, 1].map(async (window) => totpCode(secret, time + window * 30000)))
  return matches.some((candidate) => safeEqual(candidate, normalized))
}

function initials(person) {
  if (!person?.lastName && !person?.firstName) return null
  return { firstInitial: (person.firstName || '').slice(0, 1), lastInitial: (person.lastName || '').slice(0, 1) }
}

function toBase64(bytes) {
  let text = ''
  bytes.forEach((byte) => { text += String.fromCharCode(byte) })
  return btoa(text)
}

function fromBase64(value) {
  const text = atob(value)
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes
}

function toBase32(bytes) {
  let bits = ''
  bytes.forEach((byte) => { bits += byte.toString(2).padStart(8, '0') })
  let output = ''
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)]
  }
  return output
}

function fromBase32(value) {
  const clean = value.toUpperCase().replace(/=+$/g, '')
  let bits = ''
  for (const char of clean) {
    const index = BASE32.indexOf(char)
    if (index < 0) throw new Error('Invalid authenticator secret.')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  return new Uint8Array(bytes)
}
