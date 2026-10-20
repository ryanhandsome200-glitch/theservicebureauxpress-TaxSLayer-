export function createSandboxCheckout(quote) {
  return {
    provider: 'unconfigured',
    paid: false,
    verified: false,
    status: 'sandbox_unpaid',
    amount: quote?.total ?? 0,
    currency: 'usd',
    cardStored: false,
    message: 'No payment provider is configured. Card numbers are not collected, and this order is not paid.',
  }
}

export function verifySandboxPayment(record) {
  return {
    verified: false,
    status: record?.payment?.status || 'unverified',
    paid: false,
    message: 'A server did not confirm payment. The order remains unpaid.',
  }
}
