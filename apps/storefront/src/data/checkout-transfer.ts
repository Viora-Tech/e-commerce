/** A UPI / bank transfer checkout kept as a draft (#D57) until the shop sees the money: the thank-you page's words. */
export const transferDraftContent = {
  received: (ref: string) => `Thank you! Your order #${ref} is received`,
  complete: 'Complete your payment to confirm it.',
  paidHeading: 'Paid already?',
  paidBody: 'Tell us, and add the UTR or reference from your UPI app or bank so we can find it.',
  utrLabel: 'UTR or reference (optional)',
  utrPlaceholder: 'e.g. 412345678901',
  paidAction: "I've paid",
  claimedHeading: 'Thanks, we are checking your payment',
  claimedBody: (ref: string) =>
    `We will confirm order #${ref} as soon as we see your transfer, and send you your order number.`,
  claimedUtr: (utr: string) => `Reference you gave: ${utr}`,
  expiredHeading: 'This checkout has expired',
  expiredBody:
    'We did not see a payment within 7 days, so the items are no longer held. If you have paid, contact the shop with your reference; otherwise please check out again.',
}
