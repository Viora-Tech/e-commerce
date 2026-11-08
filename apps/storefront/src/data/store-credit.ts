/**
 * A signed-in shopper's store credit at checkout: the summary row (on by default, a switch to
 * turn it off), its line under the total and what the Payment step says when it pays it all.
 * It is a way to pay, not a discount, so it sits under the total.
 */
export const storeCreditCheckoutContent = {
  label: 'Store credit',
  have: (amount: string) => `You have ${amount} in store credit`,
  use: 'Use store credit',
  applied: (amount: string) => `${amount} applied to this order`,
  paidBy: 'Paid by store credit',
  paidByBoth: 'Paid by gift card and store credit',
  codNote: 'Not available with store credit for part of the order',
} as const
