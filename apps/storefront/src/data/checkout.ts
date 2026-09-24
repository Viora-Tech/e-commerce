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
    failed: (total: string) =>
      `Your payment of ${total} did not go through. Your order is saved; try again when ready.`,
    giftCard: 'Paid in full with your gift card.',
    giftCardEmail: (email: string | null) =>
      email
        ? `Your gift card is on its way to ${email}. It usually arrives within a few minutes.`
        : 'Your gift card will arrive by email within a few minutes.',
  },
  giftCardPaid: (last: string) => `Gift card •••• ${last}`,
  payNow: 'Pay now',
  retryPayment: 'Retry payment',
  continueShopping: 'Continue shopping',
  subtotal: 'Subtotal',
  discount: 'Discount',
  shipping: 'Shipping',
  shippingRow: (rate: string | null) => (rate ? `Shipping (${rate})` : 'Shipping'),
  shippingFree: 'Free',
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
  discount: 'Discount',
  shipping: 'Shipping',
  shippingFree: 'Free',
  /** Summary row before an address has been checked. */
  shippingPending: 'Enter your PIN code',
  shippingMethod: 'Shipping method',
  rateDelivery: (range: string) => `Delivery by ${range}`,
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
    noRates: (pincode: string) => `We do not ship to ${pincode} yet.`,
  },
  giftCardAddress: 'Billing address',
  giftCardDelivery: 'Gift cards are delivered by email as soon as the payment is confirmed.',
  paidByGiftCard: 'Paid by gift card',
  totalDue: 'To pay',
  codWithGiftCard: 'Not available with a gift card',
  errors: {
    unserviceable: (pincode: string) => `We cannot deliver to ${pincode} yet. Try another address.`,
    codUnavailable:
      'Cash on delivery is not available for this PIN code. Pick another payment method.',
    noShipping: (pincode: string) => `We do not ship to ${pincode} yet. Try another address.`,
    rateChanged:
      'The shipping options for your order changed, so it was not placed. Pick a shipping method and place it again.',
    discountUnavailable:
      'That discount has just run out, so your order was not placed. Check the new total and place it again.',
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

export const giftCardFieldContent = {
  label: 'Gift card',
  placeholder: 'Gift card code',
  apply: 'Apply',
  remove: 'Remove',
  applied: (last: string) => `Gift card •••• ${last}`,
  balance: (amount: string) => `Balance ${amount}`,
  duplicate: 'That gift card is already applied.',
  errors: {
    not_found: 'Enter a valid gift card code.',
    disabled: 'This gift card has been disabled.',
    expired: 'This gift card has expired.',
    empty: 'This gift card has no balance left.',
    not_allowed: 'Gift cards cannot be used on this order.',
  } as Record<string, string>,
} as const
