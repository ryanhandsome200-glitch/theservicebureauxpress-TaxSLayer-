export function notificationsFor(record) {
  if (!record) return []
  const notes = []
  if (!(record.incomeItems || []).length) {
    notes.push({ id: `${record.id}-income`, kind: 'reminder', text: 'This return does not have any income entries yet.' })
  }
  if ((record.validation?.errors || []).length) {
    notes.push({ id: `${record.id}-errors`, kind: 'reminder', text: `${record.validation.errors.length} item${record.validation.errors.length === 1 ? '' : 's'} still need attention before submission.` })
  }
  if (record.payment?.status === 'sandbox_unpaid') {
    notes.push({ id: `${record.id}-pay`, kind: 'payment', text: 'The preparation fee is unpaid. No card was charged.' })
  }
  if (record.filing?.environment === 'sandbox') {
    notes.push({ id: `${record.id}-filing`, kind: 'filing', text: 'The filing sandbox did not submit this return and did not produce an acceptance.' })
  }
  return notes
}
