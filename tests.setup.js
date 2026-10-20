import { webcrypto } from 'node:crypto'
import '@testing-library/jest-dom/vitest'

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
