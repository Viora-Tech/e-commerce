/** Checkout's words for a repeated checkout: the same items again, an unpaid transfer, too many unpaid orders. */

export const checkoutRepeatContent = {
  /** The same items, still waiting for payment: no new order. */
  unpaidDuplicate: (n: number) => `You already have this order: #${n}, waiting for payment.`,
  completePayment: 'Complete payment',
  /** Manual transfer orders: the status page offers paying online instead. */
  changeMethod: 'Change payment method',
  /** The same items, already placed: asked before a second order. */
  placedDuplicate: (minutes: number, n: number) =>
    `You ordered this ${minutes === 1 ? '1 minute' : `${minutes} minutes`} ago (#${n}). Order again?`,
  viewOrder: 'View my order',
  orderAgain: 'Yes, order again',
  /** One unpaid UPI or bank transfer order per shopper. */
  unpaidTransfer: (n: number) =>
    `You already have an unpaid order #${n}. Pay for it, or choose another payment method.`,
  payForIt: 'Pay for order',
  tooMany: 'Too many unpaid orders. Please complete one first.',
  latestOrder: 'Open my latest unpaid order',
}
