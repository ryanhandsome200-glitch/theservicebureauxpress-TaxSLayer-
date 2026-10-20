export function createSandboxSubmission(idempotencyKey) {
  return {
    environment: 'sandbox',
    submitted: false,
    accepted: false,
    rejected: false,
    submissionId: null,
    idempotencyKey,
    providerConfigured: false,
    message: 'No authorized e-file provider is configured. This return was not sent to the IRS or a state agency.',
  }
}

export function sameSubmission(existing, idempotencyKey) {
  return Boolean(existing && existing.idempotencyKey === idempotencyKey)
}
