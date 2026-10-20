const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const MAX_BYTES = 5 * 1024 * 1024

export function validateUpload(file) {
  if (!file || !ALLOWED.has(file.type)) return { ok: false, error: 'Use a PDF, PNG, or JPEG.' }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) return { ok: false, error: 'Files must be 5 MB or smaller.' }
  return { ok: true }
}

export function extractionResult() {
  return {
    status: 'unavailable',
    fields: [],
    applied: false,
    message: 'No document-extraction provider is configured. Enter the amounts yourself. Nothing was applied to the return.',
  }
}
