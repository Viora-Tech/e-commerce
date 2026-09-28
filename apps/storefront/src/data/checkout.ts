/**
 * Every string the checkout and thank-you screens show. Change copy here,
 * never inside a component.
 */
/** A deposit pre-order's balance, wherever the shopper sees it (thank-you, account, pay link). */
export const balanceContent = {
  heading: 'Balance due',
  paid: (deposit: string) => `Paid up front: ${deposit}`,
  due: (balance: string) => `Balance due: ${balance}`,
  payBy: (date: string) => `Please pay by ${date}.`,
  nonRefundable: (days: number) =>
    `The deposit is non-refundable if the balance is not paid within ${days} days of our request.`,
  pay: (balance: string) => `Pay balance ${balance}`,
  settled: 'The balance is paid. Thank you.',
  unavailable: 'This link is no longer valid. Sign in to your account to see the order.',
  pageTitle: (number: number) => `Pay the balance for order #${number}`,
} as const

export const thankYouContent = {
  heading: (number: number) => `Thank you, order #${number} is in`,
  confirmation: (email: string | null) =>
    email ? `A confirmation is on its way to ${email}.` : 'We will be in touch about delivery.',
  status: {
    cod: (total: string) => `Pay ${total} in cash when it arrives.`,
    awaiting: (total: string) => `We are confirming your payment of ${total}.`,
    manual: 'Your order is reserved until we receive your transfer.',
    upiQr: (total: string) =>
      `Scan the QR with any UPI app to pay ${total}. This page updates on its own once it is paid.`,
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
  newQr: 'Get a new UPI QR',
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

/** "UPI — confirmed automatically": the Razorpay UPI QR on the thank-you page. */
export const upiQrContent = {
  heading: (amount: string) => `Pay ${amount} by UPI`,
  qrAlt: (amount: string) => `UPI QR code for ${amount}`,
  closesIn: (clock: string) => `This QR closes in ${clock}.`,
  help: 'Scan with Google Pay, PhonePe, Paytm or any UPI app. The amount is filled in for you.',
  open: 'Open in UPI app',
  expired: 'This QR has closed. Your order is still saved; get a new QR to pay.',
  renew: 'Get a new QR',
} as const

/** Pixel size of the rendered UPI QR on the thank-you page. */
export const UPI_QR_SIZE = 220

export const checkoutContent = {
  title: 'Checkout',
  contact: 'Contact',
  address: 'Delivery address',
  payment: 'Payment',
  /** The main gateway's option when the merchant chose which online methods to offer. */
  payOnline: 'Pay online',
  onlineMethodNames: {
    upi: 'UPI',
    card: 'Cards',
    netbanking: 'Netbanking',
    wallet: 'Wallets',
    emi: 'EMI and pay later',
  } as Record<string, string>,
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
    emailOptional: 'Email (optional)',
    phoneHint: '10 digit mobile number. The courier calls it on delivery.',
    gstin: 'GSTIN (optional)',
    gstinHint: 'For a GST invoice in your business name.',
    businessName: 'Business name',
    note: 'Order note (optional)',
    notePlaceholder: 'For example, please call before delivery',
  },
  pincodeFirst: {
    finding: 'Finding your city…',
    found: (city: string, state: string) => `${city}, ${state}. Change it below if needed.`,
  },
  business: 'Buying for a business?',
  minimumOrder: (min: string, missing: string) =>
    `The minimum order is ${min}. Add ${missing} more to check out.`,
  codRules: {
    blockedPincode: 'Not available for this PIN code',
    overLimit: (limit: string) => `Available on orders up to ${limit}`,
  },
  agreement: 'By placing your order, you agree to our',
  agreementAnd: 'and',
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
  depositNonRefundable: (days: number) =>
    `Pre-order deposits are non-refundable if the balance is not paid within ${days} days of our request.`,
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
    rateLimited: 'Too many attempts. Please wait a minute and try again.',
    contact: 'Check your contact details and try again.',
    minimumOrder: (missing: string) =>
      `Your order is below this shop's minimum. Add ${missing} more and try again.`,
    codOverLimit: (limit: string) =>
      `Cash on delivery is available on orders up to ${limit}. Please pay online.`,
  },
} as const

export const INDIAN_STATES: readonly [string, string][] = [
  ['AN', 'Andaman and Nicobar Islands'],
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CG', 'Chhattisgarh'],
  ['CH', 'Chandigarh'],
  ['DN', 'Dadra and Nagar Haveli and Daman and Diu'],
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
  ['LD', 'Lakshadweep'],
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
    rate_limited: 'Too many tries. Wait a minute, then try again.',
  } as Record<string, string>,
} as const
