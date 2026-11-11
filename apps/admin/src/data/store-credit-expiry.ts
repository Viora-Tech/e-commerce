/** The store credit expiry date in the refund, cancel and return dialogs. */
export const storeCreditExpiryContent = {
  label: 'Store credit expiry (optional)',
  placeholder: 'Never expires',
  hint: 'The last day it can be spent. Whatever is left comes off the balance after that day. Leave empty and it never expires.',
  backHint: (day: string | null) =>
    day
      ? `Filled in with the last day of the store credit this order was paid with (${day}). Change it, or clear it so it never expires.`
      : 'The store credit this order was paid with never expired. Pick a last day, or leave empty so it never expires.',
  returned: (amount: string) =>
    `${amount} of store credit this order was paid with goes back onto the customer’s balance.`,
}
