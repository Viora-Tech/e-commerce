/**
 * Every string the checkout and thank-you screens show. Change copy here,
 * never inside a component.
 */
export const thankYouContent = {
  heading: (number: number) => `Thank you, order #${number} is in`,
  confirmation: (email: string | null) =>
    email ? `A confirmation is on its way to ${email}.` : 'We will be in touch about delivery.',
  status: {
    cod: (total: string) => `Pay ${total} in cash when it arrives.`,
    awaiting: (total: string) => `We are confirming your payment of ${total}.`,
    manual: 'Your order is reserved until we receive your transfer.',
    paid: (total: string) => `Payment of ${total} received.`,
  },
  payNow: 'Pay now',
  continueShopping: 'Continue shopping',
  lineTitle: (title: string | null, variant: string | null) =>
    variant && variant !== 'Default' ? `${title ?? ''} / ${variant}` : (title ?? ''),
} as const

export const manualPaymentContent = {
  intro: (total: string, reference: string) =>
    `Pay ${total} and quote ${reference} so we can match it. We confirm the order once the money arrives.`,
  upi: {
    heading: 'UPI',
    idLabel: 'UPI ID',
    open: 'Open UPI app',
    qrAlt: (upiId: string) => `UPI QR for ${upiId}`,
  },
  bank: {
    heading: 'Bank transfer',
    rows: {
      bankName: 'Bank',
      accountName: 'Account name',
      accountNumber: 'Account number',
      ifsc: 'IFSC',
      reference: 'Reference',
    },
  },
} as const

/** Pixel size of the rendered UPI QR on the thank-you page. */
export const UPI_QR_SIZE = 220
