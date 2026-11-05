/* Copy of the two ways to pay that finish on the result page: a transfer and the UPI QR. */

export const manualPaymentContent = {
  intro: (total: string, reference: string) =>
    `Pay ${total} and quote ${reference} so we can match it. We confirm the order once the money arrives.`,
  copy: 'Copy',
  copied: 'Copied',
  copyLabel: (what: string) => `Copy ${what}`,
  upi: {
    title: 'UPI',
    heading: (amount: string) => `Scan to pay ${amount}`,
    help: 'Scan with any UPI app, or pay to the UPI ID below.',
    idLabel: 'UPI ID',
    amount: 'Amount',
    note: 'Note',
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

/** "UPI — confirmed automatically": the Razorpay UPI QR on the thank-you page. */
export const upiQrContent = {
  heading: (amount: string) => `Pay ${amount} by UPI`,
  qrAlt: (amount: string) => `UPI QR code for ${amount}`,
  closesIn: (clock: string) => `This QR closes in ${clock}.`,
  help: 'Scan with Google Pay, PhonePe, Paytm or any UPI app. The amount is filled in for you.',
  open: 'Open in UPI app',
  /** Phone buttons, one per app Decentro-style gateways return a link for. */
  payWith: 'Pay with',
  apps: { gpay: 'Google Pay', phonepe: 'PhonePe', paytm: 'Paytm', cred: 'CRED' },
  otherApp: 'Other UPI app',
  paid: "I've paid",
  checking: 'Checking…',
  notYet: 'Not received yet. It can take a minute; this page updates on its own.',
  expired: 'This QR has closed. Your order is still saved; get a new QR to pay.',
  renew: 'Get a new QR',
  waiting: 'Waiting for your payment',
} as const

/** Pixel size of the rendered UPI QR on the thank-you page. */
export const UPI_QR_SIZE = 220
