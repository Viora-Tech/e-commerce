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
  subtotal: 'Subtotal',
  total: 'Total',
  /** Fallback label for a fee/discount row when the merchant left the label blank. */
  adjustmentFallback: (paise: number) => (paise < 0 ? 'Payment discount' : 'Payment fee'),
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

export const checkoutContent = {
  title: 'Checkout',
  contact: 'Contact',
  address: 'Delivery address',
  payment: 'Payment',
  summary: 'Order summary',
  subtotal: 'Subtotal',
  total: 'Total',
  placeOrder: 'Place order',
  continueToPayment: 'Continue to payment',
  fields: {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    line1: 'Address',
    line2: 'Apartment, landmark (optional)',
    city: 'City',
    state: 'State',
    pincode: 'Pincode',
  },
  adjustmentFallback: thankYouContent.adjustmentFallback,
  delivery: {
    checking: 'Checking delivery…',
    estimate: (range: string) => `Delivery by ${range}`,
    codUnavailable: 'Cash on delivery is not available for this PIN code.',
    unserviceable: (pincode: string) => `We cannot deliver to ${pincode} yet.`,
  },
  errors: {
    unserviceable: (pincode: string) => `We cannot deliver to ${pincode} yet. Try another address.`,
    codUnavailable:
      'Cash on delivery is not available for this PIN code. Pick another payment method.',
  },
} as const

export const INDIAN_STATES: readonly [string, string][] = [
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CG', 'Chhattisgarh'],
  ['CH', 'Chandigarh'],
  ['DL', 'Delhi'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'],
  ['JK', 'Jammu and Kashmir'],
  ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['LA', 'Ladakh'],
  ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'],
  ['MN', 'Manipur'],
  ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OD', 'Odisha'],
  ['PY', 'Puducherry'],
  ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'],
  ['TS', 'Telangana'],
  ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'],
  ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
]
