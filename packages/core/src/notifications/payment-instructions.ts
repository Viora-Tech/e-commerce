import type { CheckoutSession, ManualInstructions } from '@commerce/payments'

/**
 * How to pay a manual UPI / bank transfer order, as plain lines for the order email: the
 * shop's UPI ID, its bank details, the reference to quote and the shop's own instructions
 * (audit #149). The same details the thank-you page shows.
 */
export function manualInstructionLines(i: ManualInstructions): string[] {
  const lines: string[] = []
  if (i.upi) lines.push(`UPI ID: ${i.upi.id} (${i.upi.payeeName})`)
  if (i.bank) {
    lines.push(
      `Bank: ${i.bank.bankName}, account ${i.bank.accountNumber} (${i.bank.accountName}), IFSC ${i.bank.ifsc}`,
    )
  }
  lines.push(`Reference: ${i.reference}`)
  for (const note of (i.note ?? '').split('\n')) if (note.trim()) lines.push(note.trim())
  return lines
}

/** The lines for a stored checkout session, or undefined when it is not a manual transfer. */
export function paymentInstructionsOf(session: unknown): string[] | undefined {
  const s = session as CheckoutSession | null | undefined
  return s?.kind === 'manual' ? manualInstructionLines(s.instructions) : undefined
}
