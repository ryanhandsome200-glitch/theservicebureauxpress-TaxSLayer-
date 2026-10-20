import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const allowed = new Set([
  'node_modules',
  '.git',
])

const unexpected = readdirSync('.').filter((name) => {
  if (!statSync(join('.', name)).isDirectory()) return false
  return !allowed.has(name)
})

if (unexpected.length) {
  console.error('Project subdirectories are not allowed:', unexpected.join(', '))
  process.exit(1)
}

console.log('Root-only check passed.')
