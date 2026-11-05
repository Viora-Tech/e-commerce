import { checkoutAbroadContent } from './checkout-abroad'
import { checkoutErrorsContent } from './checkout-errors'
import { checkoutExpressContent } from './checkout-express'
import { checkoutFieldsContent } from './checkout-fields'
import { checkoutStepsContent } from './checkout-steps'
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

/** The signed page a draft invoice email's "Pay securely" button opens. */
export const invoiceContent = {
  /** `ref` follows the #: "D12" while the invoice is a draft. */
  pageTitle: (ref: string) => `Invoice #${ref}`,
  intro: (store: string) =>
    `${store} sent you this invoice. Check the items, then pay securely online.`,
  quantity: (n: number) => `Qty ${n}`,
  total: 'Total',
  pay: (total: string) => `Pay ${total}`,
  paying: 'Opening secure payment',
  unavailable: 'This invoice link is no longer valid. Ask the store for a new one.',
  busy: 'Too many tries. Wait a minute and try again.',
  noGateway: 'This store cannot take online payments right now. Please contact them to pay.',
  outOfStock: 'Something on this invoice is out of stock now. Please contact the store.',
  noAddress: 'This invoice has no delivery address yet. Please contact the store to add one.',
  back: 'Back to the shop',
} as const

export const thankYouContent = {
  /** The headline while the order still waits on its payment. */
  headline: {
    pending: 'Complete your payment',
    failed: 'Your payment did not go through',
  },
  /** The headline once the order is placed: "Thank you, Asha!". */
  thanks: (name: string | null) => (name ? `Thank you, ${name}!` : 'Thank you!'),
  /** The first card's heading, by where the order stands. */
  card: {
    confirmed: 'Your order is confirmed',
    pending: 'Waiting for your payment',
    failed: 'Payment not received',
    cancelled: 'This order was cancelled',
    refunded: 'This order was refunded',
    returning: 'This order is on its way back to us',
  },
  /** Where order updates go: the contacts the order was placed with. */
  updates: (contact: string | null) =>
    contact ? `We will send updates to ${contact}.` : 'We will be in touch about delivery.',
  arrives: (range: string) => `Expected delivery ${range}.`,
  /** The four-step progress bar under the first card's line. */
  progress: {
    label: 'Order progress',
    steps: { confirmed: 'Confirmed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered' },
  },
  /** The Payment cell of Order details. */
  paid: (amount: string) => `${amount} paid`,
  codToPay: (amount: string) => `Cash on delivery · ${amount} to pay`,
  due: (amount: string) => `${amount} to pay`,
  giftCardLine: (last: string, amount: string) => `Gift card •••• ${last} · ${amount}`,
  /** The Shipping cell: "Standard · Free". */
  shippingLine: (rate: string, price: string) => `${rate} · ${price}`,
  trackOrder: 'Track your order',
  orderNumber: (number: number) => `Order #${number}`,
  status: {
    awaiting: (total: string) => `We are confirming your payment of ${total}.`,
    manual: 'Your order is reserved until we receive your transfer.',
    upiQr: (total: string) =>
      `Pay ${total} with any UPI app. This page updates on its own once it is paid.`,
    failed: (total: string) =>
      `Your payment of ${total} did not go through. Your order is saved; try again when ready.`,
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
    delivery: 'Shipping',
    payment: 'Payment',
  },
  /** How the order is paid, by provider; never a gateway's brand name. */
  methods: {
    cod: 'Cash on delivery',
    decentro: 'UPI',
    manual: 'UPI or bank transfer',
    gift_card: 'Gift card',
    online: 'Online payment',
  } as Record<string, string>,
  giftCardPaid: (last: string) => `Gift card •••• ${last}`,
  payNow: 'Pay now',
  retryPayment: 'Retry payment',
  newQr: 'Get a new UPI QR',
  /** A transfer order's way to pay through the store's gateway instead (issue 1010). */
  payOnline: {
    heading: 'Or pay online',
    body: 'Pay now with UPI, card or netbanking and your order is confirmed straight away.',
    action: 'Pay online now',
    alreadySent: 'Already sent the transfer? You do not need to pay again; we will confirm it.',
  },
  continueShopping: 'Continue shopping',
  subtotal: 'Subtotal',
  discount: 'Discount',
  shipping: 'Shipping',
  /** The rate's own name ("Bluedart") when the order has one, else "Shipping". */
  shippingRow: (rate: string | null) => rate || 'Shipping',
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
  /** What closing the window means, under Try again. */
  saved: 'Nothing was charged. Your order is held for a little while; pay now or come back to it.',
  otherWays: 'See your order and other ways to pay',
  continueShopping: 'Continue shopping',
  paidWith: (provider: string) => `Paying with ${provider}`,
  providers: {
    razorpay: 'Razorpay: UPI, cards, netbanking',
    cashfree: 'Cashfree: UPI, cards, netbanking',
  } as Record<string, string>,
  secure: 'Payments are encrypted and handled by the payment provider.',
} as const

export const checkoutContent = {
  /** The marketing ticks under Contact; never ticked for the shopper. */
  marketing: {
    email: 'Email me news and offers',
    whatsapp: 'Send me offers on WhatsApp',
  },
  title: 'Checkout',
  backToCart: 'Back to cart',
  contact: 'Contact',
  address: 'Delivery',
  deliveryMethod: 'Delivery method',
  payment: 'Payment',
  /** Every way to pay is hidden for this order (a payment rule). */
  noWayToPay:
    'There is no way to pay for this order right now. Change your cart or delivery address, or contact the store.',
  /** Beside a way to pay whose gateway runs on test keys (Settings → Payments, Test). */
  testMode: 'Test mode',
  testModeHint: 'No real money is charged.',
  /** The one page's numbered cards (design: checkout-design Main and Mobile). */
  sections: {
    label: { contact: 'Contact', address: 'Address', shipping: 'Delivery', payment: 'Payment' },
    /** Gift cards are emailed: the second card only asks for billing details. */
    detailsLabel: 'Billing',
    /** Read after a card's heading once its part is filled in. */
    done: 'Complete',
    signIn: 'Sign in',
    /** Beside the Shipping heading: the PIN code the options are for. */
    paymentNote: 'Encrypted and secure',
  },
  /**
   * Contact: a code to the shopper's mobile first (the store's own
   * sign-in: SMS or WhatsApp, email, Google, Apple, Truecaller, passkeys). Signing in also
   * creates the account. Settings → Customer accounts decides whether a guest may skip it.
   */
  otp: {
    sendCode: 'Continue',
    sending: 'Sending code…',
    codeLabel: 'Six digit code',
    sentTo: (to: string, by: string) => `We sent a code to ${to} by ${by}.`,
    sentToEmail: (to: string) => `We sent a code to ${to}.`,
    verify: 'Verify and continue',
    verifying: 'Verifying…',
    resend: 'Send a new code',
    change: 'Change',
    emailLabel: 'Email',
    contactLabel: 'Phone number or email',
    countryCode: '+91',
    guestLead: 'Just buying once?',
    guest: 'Check out as guest',
    signInInstead: 'Sign in with a code instead',
    required: 'This shop needs an account to check out. Signing in creates one.',
    optional: 'Signing in fills in your saved addresses. New here? It creates your account.',
    needSignIn: 'Verify your mobile number, or check out as a guest, to pay.',
    needSignInRequired: 'Verify your mobile number to pay.',
  },
  /** Signed-in shoppers' saved addresses as cards, and the PIN-first form for a new one. */
  addressBook: {
    legend: 'Saved addresses',
    intro: 'Choose a saved address or add a new one.',
    tags: { home: 'Home', office: 'Office', other: 'Other' },
    tagLegend: 'Save this address as',
    noTag: 'No tag',
    add: 'Add new address',
    newHeading: 'New address',
    editHeading: 'Edit address',
    edit: (name: string) => `Edit the address for ${name}`,
    remove: (name: string) => `Delete the address for ${name}`,
    confirmRemove: 'Delete this address?',
    confirmYes: 'Delete',
    confirmNo: 'Keep it',
    save: 'Save address',
    saving: 'Saving…',
    cancel: 'Cancel',
    saveFailed: 'We could not save that address. Check the fields and try again.',
    deliversTo: (pincode: string) => `Delivers to ${pincode}`,
  },
  secure: 'Secure checkout',
  policiesLabel: 'Policies',
  itemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  /** The main gateway's option when the merchant chose which online methods to offer. */
  payOnline: 'Pay online',
  onlineMethodNames: {
    upi: 'UPI',
    card: 'Cards',
    netbanking: 'Netbanking',
    wallet: 'Wallets',
    emi: 'EMI and pay later',
  } as Record<string, string>,
  /** The payment gateways by brand: a gateway's option is titled with it. */
  gatewayBrands: { razorpay: 'Razorpay', cashfree: 'Cashfree' } as Record<string, string>,
  /** Decentro's UPI option wears its name chip too; it is not a card gateway. */
  upiBrand: 'Decentro',
  /** What each way to pay is called and what it does, by provider. */
  methods: {
    upi: 'UPI',
    upiHint: 'Google Pay, PhonePe, Paytm or any UPI app',
    upiQrDesktop: 'Scan a QR with any UPI app on your phone',
    gatewayWithUpi: 'UPI, cards and more',
    gatewayNoUpi: 'Cards and netbanking',
    cod: 'Cash on delivery',
    codHint: 'Pay in cash when your order arrives',
    manual: 'UPI ID or bank deposit',
    /** Only the shop's UPI ID is on. */
    manualUpi: 'UPI ID',
    /** Only bank transfer is on. */
    manualBank: 'Bank deposit',
    manualHint: 'We confirm your order once the money arrives',
  },
  /** What opens under the picked way to pay. */
  methodPanel: {
    upi: (amount: string) =>
      `Pay ${amount} straight from your bank with any UPI app. On a phone your app opens; on a computer you scan a QR code.`,
    gateway: (brand: string) => `You finish on ${brand}'s secure screen.`,
    /** A method's discount: "2% off". */
    saving: (amount: string) => `${amount.replace('−', '')} off`,
    /** The small marks under each way to pay. */
    upiApps: ['GPay', 'PhonePe', 'Paytm'],
    cardMarks: ['VISA', 'Mastercard', 'RuPay'],
    upiMark: 'UPI',
  },
  /** Under the Pay button: the gateways that handle the money. */
  processors: (names: string[]) => `Payments processed by ${names.join(' · ')}`,
  express: checkoutExpressContent,
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
  /** Abroad there is no PIN code: the address decides the options (#64). */
  shippingPendingAbroad: 'Enter your address',
  shippingMethod: 'Shipping method',
  rateDelivery: (range: string) => `Delivery by ${range}`,
  total: 'Total',
  taxes: 'Inclusive of all taxes',
  taxesIncluded: (gst: string) => `Includes ${gst} GST`,
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
  help: { label: 'Need help? WhatsApp us', short: 'Help', aria: 'Need help? WhatsApp us' },
  ...checkoutStepsContent,
  /** Under the Pay button: "Secured by Razorpay", or the plain line when no gateway is named. */
  payNote: { by: 'Secured by', plain: 'Secure checkout' },
  /** The summary's delivery box: "Delivers to 122001 by Thu, 29 Oct". */
  deliversTo: { to: 'Delivers to', by: 'by' },
  assurance: {
    title: 'Secure payment',
    body: 'Encrypted by the payment provider. We never see your card or UPI PIN.',
  },
  trust: {
    secure: 'Secure checkout',
    encrypted:
      'Payments are encrypted and handled by the payment provider. We never see your card or UPI PIN.',
  },
  fields: checkoutFieldsContent,
  /** Inline messages, shown once a field has been left or the shopper tried to pay. */
  validation: {
    name: 'Enter your full name',
    firstName: 'Enter your first name',
    lastName: 'Enter your last name',
    line2: 'Enter a landmark',
    company: 'Enter your company name',
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
  abroad: checkoutAbroadContent,
  pincodeFirst: {
    finding: 'Finding your city…',
    found: (city: string, state: string) => `${city}, ${state}`,
    foundBy: (city: string, state: string, by: string) => `${city}, ${state} · by ${by}`,
  },
  business: 'Get a GST invoice for my business',
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
    /** An address abroad that no shipping zone covers. */
    noRatesAbroad: 'We do not ship to this country yet.',
    pending: 'Enter your PIN code to see delivery options.',
    pendingAbroad: 'Enter your address to see delivery options.',
    free: 'Free delivery',
    standard: 'Standard delivery',
    /** Each option's arrival, counted from today in the store's time zone. */
    arrives: (when: string) => `Arrives ${when}`,
    arrivesToday: 'Arrives today',
    arrivesTomorrow: (date: string) => `Arrives tomorrow, ${date}`,
    /** On the option that arrives first, when the options do not all arrive together. */
    fastest: 'Fastest',
    digital: 'Delivered by email',
  },
  /** When one order ships as more than one parcel (several warehouses, or a pre-order held back). */
  parcels: {
    title: (count: number) => `Ships in ${count} parcels`,
    note: 'One order and one payment. Each parcel ships on its own, with its own invoice.',
    parcel: (position: number) => `Parcel ${position}`,
    from: (place: string) => `from ${place}`,
    arrives: (range: string) => `Arrives ${range}`,
    onHold: 'Pre-order: ships when it arrives',
    item: (quantity: number, title: string) => `${quantity} × ${title}`,
  },
  giftCardAddress: 'Billing address',
  giftCardDelivery: 'Gift cards are delivered by email as soon as the payment is confirmed.',
  depositNonRefundable: (days: number) =>
    `Pre-order deposits are non-refundable if the balance is not paid within ${days} days of our request.`,
  paidByGiftCard: 'Paid by gift card',
  /**
   * Under the summary and in the Payment card on a market in another currency: Pay still
   * charges rupees (Markets M2). `approx` is the rupees converted, not the catalog prices.
   */
  chargedInRupees: (rupees: string, approx: string) =>
    `You'll be charged ${rupees} in Indian rupees (about ${approx}). ` +
    'Your bank converts it at its own rate.',
  totalDue: 'To pay',
  codWithGiftCard: 'Not available with a gift card',
  errors: checkoutErrorsContent,
} as const

/**
 * The checkout's words as a card reads them: `checkoutContent` with the store's own wording
 * written over the strings it may change (Settings → Checkout → Checkout content, #158;
 * `applyCheckoutText`, `CHECKOUT_TEXT_KEYS`).
 */
export type CheckoutCopy = typeof checkoutContent

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
