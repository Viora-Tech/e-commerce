/**
 * Store credit on a draft order: the customer's balance, "Apply store credit" (part or all of it,
 * never more than the total), the lines it adds to the bill, and why it cannot stand.
 */
export const draftStoreCreditContent = {
  heading: 'Store credit',
  balance: (amount: string) => `Balance ${amount}`,
  none: 'This customer has no store credit.',
  apply: 'Apply store credit',
  applied: (amount: string) => `${amount} applied`,
  appliedNote: 'Taken from the balance when the draft is converted to an order.',
  edit: 'Change',
  remove: 'Remove',
  loadFailed: 'Could not load store credit.',
  dialog: {
    title: 'Apply store credit',
    amount: 'Amount',
    max: (amount: string) => `Up to ${amount}: the balance, or the draft's total if that is less.`,
    fillMax: (amount: string) => `Use ${amount}`,
    tooMuch: (amount: string) => `That is more than ${amount}.`,
    apply: 'Apply',
    cancel: 'Cancel',
  },
  /** Lines in the Payment card under the total. */
  line: 'Store credit',
  toPay: 'To pay',
  /** Why the draft cannot convert while the store credit stands as it is. */
  problems: {
    no_customer: 'Pick a customer to use store credit, or remove it.',
    over_total: 'Store credit is more than the total. Lower it.',
    over_balance: "Store credit is more than the customer's balance. Lower it.",
  },
  /** Send invoice is off when store credit pays it all. */
  nothingToInvoice: 'Store credit pays all of it. Convert it to an order instead.',
}
