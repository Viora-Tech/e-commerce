/** Copy for the order invoice link in the payment email (`documents/order/[orderId]`). */
export const invoiceLinkContent = {
  title: 'Your invoice',
  invalid: 'This link has expired or is not valid.',
  notReady: 'Your invoice is being prepared. Please open this link again in a little while.',
  /** A split order (one invoice per GSTIN) lists each one. */
  several: 'Your order has more than one invoice:',
  invoice: (number: string | null) => (number ? `Invoice ${number}` : 'Invoice'),
}
