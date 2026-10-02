/**
 * Every string the checkout, payment and thank-you screens show. Change copy here,
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
  /** The checkout-styled balance block's two rows. */
  paidLabel: 'Paid up front',
  dueLabel: 'Balance due',
  back: 'Back to the shop',
} as const

export const thankYouContent = {
  heading: (number: number) => `Thank you, order #${number} is in`,
  /** The calm headline above the status line, by where the order stands. */
  headline: {
    confirmed: 'Thank you for your order',
    pending: 'Complete your payment',
    failed: 'Your payment did not go through',
    cod: 'Your order is confirmed',
  },
  orderNumber: (number: number) => `Order #${number}`,
  confirmation: (email: string | null) =>
    email ? `A confirmation is on its way to ${email}.` : 'We will be in touch about delivery.',
  status: {
    cod: (total: string) => `Pay ${total} in cash when it arrives.`,
    awaiting: (total: string) => `We are confirming your payment of ${total}.`,
    manual: 'Your order is reserved until we receive your transfer.',
    upiQr: (total: string) =>
      `Pay ${total} with any UPI app. This page updates on its own once it is paid.`,
    paid: (total: string) => `Payment of ${total} received.`,
    failed: (total: string) =>
      `Your payment of ${total} did not go through. Your order is saved; try again when ready.`,
    giftCard: 'Paid in full with your gift card.',
    giftCardEmail: (email: string | null) =>
      email
        ? `Your gift card is on its way to ${email}. It usually arrives within a few minutes.`
        : 'Your gift card will arrive by email within a few minutes.',
  },
  summary: 'Order summary',
  details: {
    heading: 'Order details',
    contact: 'Contact',
    shipTo: 'Delivering to',
    delivery: 'Delivery',
    payment: 'Payment',
  },
  /** How the order is paid, by provider; never a gateway's brand name. */
  methods: {
    cod: 'Cash on delivery',
    decentro: 'UPI',
    manual: 'UPI or bank transfer',
    gift_card: 'Gift card',
    online: 'Paid online',
  } as Record<string, string>,
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
  quantity: (n: number) => `Qty ${n}`,
  /** Fallback label for a fee/discount row when the merchant left the label blank. */
  adjustmentFallback: (paise: number) => (paise < 0 ? 'Payment discount' : 'Payment fee'),
  lineTitle: (title: string | null, variant: string | null) =>
    variant && variant !== 'Default' ? `${title ?? ''} / ${variant}` : (title ?? ''),
  variantTitle: (variant: string | null) => (variant && variant !== 'Default' ? variant : null),
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

/** The page that opens Razorpay or Cashfree's own payment window. */
export const payClientContent = {
  heading: (number: number) => `Order #${number}`,
  state: {
    loading: 'Opening secure payment.',
    ready: 'Complete the payment in the window.',
    confirming: 'Confirming your payment.',
    failed: 'The payment could not be verified. You can try again.',
    dismissed: 'Payment window closed. Your order is saved; pay when ready.',
  },
  tryAgain: 'Try again',
  back: 'Back to your order',
  secure: 'Payments are encrypted and handled by the payment provider.',
} as const

export const checkoutContent = {
  title: 'Checkout',
  backToCart: 'Back to cart',
  contact: 'Contact',
  address: 'Delivery',
  deliveryMethod: 'Delivery method',
  payment: 'Payment',
  /** Step numbers read out with the heading, e.g. "Step 2 of 4". */
  step: (n: number, of: number) => `Step ${n} of ${of}`,
  stepDone: 'Complete',
  /** The main gateway's option when the merchant chose which online methods to offer. */
  payOnline: 'Pay online',
  onlineMethodNames: {
    upi: 'UPI',
    card: 'Cards',
    netbanking: 'Netbanking',
    wallet: 'Wallets',
    emi: 'EMI and pay later',
  } as Record<string, string>,
  /** What each way to pay is called and what it does, by provider. */
  methods: {
    upi: 'UPI',
    upiHint: 'Google Pay, PhonePe, Paytm or any UPI app',
    upiQrDesktop: 'Scan a QR with any UPI app on your phone',
    gatewayWithUpi: 'UPI, cards and more',
    gatewayNoUpi: 'Cards and netbanking',
    cod: 'Cash on delivery',
    codHint: 'Pay in cash when your order arrives',
    manual: 'UPI or bank transfer to the shop',
    manualHint: 'We confirm your order once the money arrives',
  },
  express: {
    heading: 'Express checkout',
    upi: 'Pay with UPI',
    upiAmount: (amount: string) => `Pay ${amount} with UPI`,
    or: 'Or fill in your details',
    needDetails: 'Add your contact and delivery details below, then tap UPI again.',
  },
  summary: 'Order summary',
  orderTotal: 'Order total',
  showSummary: 'Show order summary',
  hideSummary: 'Hide order summary',
  quantity: (n: number) => `Qty ${n}`,
  preorder: 'Pre-order',
  subtotal: 'Subtotal',
  discount: 'Discount',
  shipping: 'Shipping',
  shippingFree: 'Free',
  /** Summary row before an address has been checked. */
  shippingPending: 'Enter your PIN code',
  shippingMethod: 'Shipping method',
  rateDelivery: (range: string) => `Delivery by ${range}`,
  total: 'Total',
  taxes: 'Inclusive of all taxes',
  /** Deposit pre-orders: what is charged now and what is left for later. */
  dueToday: 'Due today',
  dueLater: 'Pre-order balance, due later',
  emi: (monthly: string) => `Or pay in EMIs from ${monthly}/month at the payment step`,
  codes: {
    discount: 'Add discount code',
    giftCard: 'Add gift card',
  },
  placeOrder: 'Place order',
  continueToPayment: 'Continue to payment',
  pay: (amount: string) => `Pay ${amount}`,
  placeOrderAmount: (amount: string) => `Place order · ${amount}`,
  processing: 'Processing…',
  trust: {
    secure: 'Secure checkout',
    encrypted:
      'Payments are encrypted and handled by the payment provider. We never see your card or UPI PIN.',
  },
  fields: {
    name: 'Full name',
    email: 'Email',
    phone: 'Mobile number',
    phonePrefix: '+91',
    emailPlaceholder: 'you@example.com',
    phonePlaceholder: '98765 43210',
    line1: 'Address',
    line1Placeholder: 'House number, street, area',
    line2: 'Apartment, landmark (optional)',
    city: 'City',
    state: 'State',
    pincode: 'PIN code',
    pincodePlaceholder: '110001',
    emailOptional: 'Email (optional)',
    phoneHint: 'The courier calls this number on delivery.',
    gstin: 'GSTIN',
    gstinHint: 'For a GST invoice in your business name.',
    businessName: 'Business name',
    note: 'Order note (optional)',
    notePlaceholder: 'For example, please call before delivery',
  },
  /** Inline messages, shown once a field has been left or the shopper tried to pay. */
  validation: {
    name: 'Enter your full name',
    email: 'Enter your email address',
    emailInvalid: 'Enter a valid email address, like name@example.com',
    phone: 'Enter a 10 digit mobile number, like 98765 43210',
    line1: 'Enter your street address',
    city: 'Enter your city',
    pincode: 'Enter a 6 digit PIN code',
    stateMismatch: (pincode: string) => `This state does not match PIN code ${pincode}`,
    fixFields: (n: number) =>
      n === 1
        ? 'Check the highlighted field to continue.'
        : `Check the ${n} highlighted fields to continue.`,
  },
  pincodeFirst: {
    finding: 'Finding your city…',
    found: (city: string, state: string) => `${city}, ${state}. Change it below if needed.`,
  },
  business: 'Add a GSTIN for a business invoice',
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
    pending: 'Enter your PIN code to see delivery options.',
    free: 'Free delivery',
    standard: 'Standard delivery',
    digital: 'Delivered by email',
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
    stateMismatch: (pincode: string) =>
      `The state you picked does not match PIN code ${pincode}. Check the state and the PIN code, then try again.`,
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
