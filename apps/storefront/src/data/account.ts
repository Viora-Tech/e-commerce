import type { ShopperPaymentState, ShopperShipmentState } from '@commerce/core'

/** Every string the shopper account pages show. */
export const accountContent = {
  title: 'Account',
  nav: {
    orders: 'Orders',
    addresses: 'Addresses',
    profile: 'Profile',
    storeCredit: 'Store credit',
    privacy: 'Your data',
    signOut: 'Sign out',
  },
  login: {
    title: 'Sign in',
    intro: 'We’ll email you a 6-digit code. No password needed.',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    sendCode: 'Send code',
    sending: 'Sending code',
    codeTitle: 'Enter the code',
    codeSent: (email: string) => `Sent to ${email}.`,
    code: 'Six digit code',
    back: 'Back',
    verify: 'Verify and sign in',
    verifying: 'Signing in',
    resend: 'Send a new code',
    resendIn: (seconds: number) => `Resend code in 0:${String(seconds).padStart(2, '0')}`,
    /** The same number by the store's other phone method: "Get it on WhatsApp". */
    getBy: (by: string) => `Get it on ${by}`,
    perks: ['Track every order', 'Easy returns', 'Faster checkout next time'],
    changeEmail: 'Use a different email',
    guestNote: 'New here? Signing in creates your account. You can still check out as a guest.',
    accountNote: 'New here? Signing in creates your account. You need one to check out.',
    phoneIntro: 'We’ll send a 6-digit code. No password needed.',
    phone: 'Mobile number',
    phonePlaceholder: '98765 43210',
    sendBy: 'Send the code by',
    methods: { sms: 'SMS', whatsapp: 'WhatsApp' },
    phoneCodeSent: (mobile: string, by: string) => `Sent by ${by} to ${mobile}.`,
    changePhone: 'Use a different number',
    usePhone: 'Use mobile number instead',
    useEmail: 'Use email instead',
    errors: {
      invalidEmail: 'Enter a valid email address.',
      invalidPhone: 'Enter a ten digit Indian mobile number.',
      noPhone: 'Sign-in by mobile is not available right now. Try email instead.',
      tooSoon: 'A code was just sent. Wait a few seconds before asking for another.',
      noEmail: 'Sign-in is not available right now. Please try again later.',
      invalid: 'That code is not right. Check the email and try again.',
      expired: 'That code has expired. Ask for a new one.',
      locked: 'Too many attempts. Ask for a new code.',
      rateLimited: 'Too many attempts. Please wait a minute and try again.',
      linkExpired: 'That sign-in link has expired. Ask for a new one.',
      linkUsed: 'That sign-in link was already used. Ask for a new one.',
      passkeyFailed: 'That passkey did not work here. Try again or use another way.',
      unavailable: 'That way to sign in is not available right now. Try another way.',
      failed: 'We could not sign you in. Please try again.',
      truecallerCode: 'That code is not right. Check the message on your phone and try again.',
      truecallerNeedsCode:
        'This number already has an account here. Sign in with your mobile number or email instead.',
    },
    /** `?error=` after a Google, Apple or Facebook sign-in, keyed by `LoginError`. */
    providerErrors: {
      unavailable: 'That way to sign in is not available right now. Try another way.',
      cancelled: 'Sign-in was cancelled. Try again or use another way.',
      expired: 'That took too long. Please try again.',
      failed: 'We could not sign you in. Please try again.',
      no_email: 'Your account there did not share an email with us. Use another way to sign in.',
      conflict: 'That account is already connected to someone else here.',
    },
    or: 'or',
    providers: {
      google: 'Continue with Google',
      apple: 'Continue with Apple',
      facebook: 'Continue with Facebook',
      truecaller: 'Continue with Truecaller',
    },
    passkey: 'Sign in with a passkey',
    passkeyWorking: 'Waiting for your passkey',
    remember: 'Keep me signed in on this device',
    magicLink: 'Email me a sign-in link instead',
    magicLinkSending: 'Sending link',
    magicLinkSent: (email: string) =>
      `We sent a sign-in link to ${email}. Open it on this device to sign in.`,
    truecallerWaiting: 'Confirm in the Truecaller app',
    truecallerMissing: 'Truecaller did not open. Use another way to sign in.',
    truecallerFailed: 'Truecaller sign-in did not finish. Use another way to sign in.',
    truecallerCodeTitle: 'One more step',
    truecallerCodeIntro:
      'This number already has an account here. We sent a six digit code to it. Enter it to sign in.',
    confirmTitle: 'Confirm your email',
    confirmIntro: (email: string) =>
      `To finish signing in, we need to check that ${email} is yours. We will send a code to it.`,
    link: {
      title: 'Sign in',
      intro: 'Tap the button to finish signing in on this device.',
      button: 'Sign in',
      working: 'Signing in',
      invalid: 'This sign-in link has expired or was already used.',
      again: 'Get a new link',
    },
  },
  security: {
    title: 'Sign-in and security',
    intro: 'Faster ways to sign in to this shop.',
    passkeysTitle: 'Passkeys',
    passkeysIntro:
      'Sign in with your fingerprint, face or screen lock. A passkey works on this website only.',
    addPasskey: 'Add a passkey',
    adding: 'Waiting for your device',
    added: 'Passkey added.',
    noPasskeys: 'No passkeys yet.',
    passkeyName: (n: number) => `Passkey ${n}`,
    devices: { ios: 'iPhone or iPad', android: 'Android', mac: 'Mac', windows: 'Windows' },
    otherDomain: (host: string) => `Works on ${host}`,
    remove: 'Remove',
    connectedTitle: 'Connected accounts',
    connectedIntro: 'Sign in with these accounts as well as your email or mobile number.',
    connect: (label: string) => `Connect ${label}`,
    providerNames: {
      google: 'Google',
      apple: 'Apple',
      facebook: 'Facebook',
      truecaller: 'Truecaller',
    },
  },
  /** The read-only Store credit page: the balance the shop holds for the shopper and its history. */
  storeCredit: {
    title: 'Store credit',
    balance: 'Your balance',
    intro: 'Store credit is used at checkout when you are signed in. You can turn it off there.',
    history: 'History',
    empty: 'No store credit yet. A refund or credit from the store shows up here.',
    added: 'Added by the store',
    removed: 'Removed by the store',
    used: (n: number | null) => (n ? `Used on order #${n}` : 'Used on an order'),
    refund: (n: number | null) => (n ? `Refund for order #${n}` : 'Refund'),
    returned: (n: number | null) =>
      n ? `Returned: order #${n} was not paid` : 'Returned from an unpaid order',
    expired: 'Expired',
    expiresOn: (day: string) => `use by ${day}`,
  },
  orders: {
    title: 'Orders',
    emptyTitle: 'No orders yet',
    emptyBody: 'When you place an order it will show up here with its delivery status.',
    shop: 'Start shopping',
    order: (n: number) => `Order #${n}`,
    items: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
    placedOn: (date: string) => `Placed ${date}`,
    view: 'View order',
  },
  order: {
    back: 'All orders',
    placedOn: (date: string) => `Placed on ${date}`,
    buyAgain: 'Buy again',
    reorderNone: 'None of these items can be bought right now.',
    items: 'Items',
    quantity: (n: number) => `Qty ${n}`,
    summary: 'Summary',
    subtotal: 'Subtotal',
    discount: 'Discount',
    shipping: 'Shipping',
    shippingFree: 'Free',
    total: 'Total',
    gstIncluded: (label: string) => `Includes GST of ${label}`,
    cgst: (rate: number) => `CGST${rate ? ` (${rate / 2}%)` : ''}`,
    sgst: (rate: number) => `SGST${rate ? ` (${rate / 2}%)` : ''}`,
    igst: (rate: number) => `IGST${rate ? ` (${rate}%)` : ''}`,
    adjustmentFallback: (paise: number) => (paise < 0 ? 'Payment discount' : 'Payment fee'),
    delivery: 'Delivery',
    shipTo: 'Shipping address',
    contact: 'Contact',
    payment: 'Payment',
    documents: 'Documents',
    tracking: 'Tracking',
    waybill: (w: string) => `Tracking number ${w}`,
    expected: (date: string) => `Expected by ${date}`,
    trackOnSite: 'Track with courier',
    noTracking: 'We will share tracking details as soon as your order ships.',
    /** Handed over without courier tracking (the shop marked it delivered or shipped it by hand). */
    noTrackingDelivered: 'Your order was delivered.',
    noTrackingShipped: 'Your order is on its way. The shop did not add courier tracking.',
    noEvents: 'The courier has not reported any scans yet.',
    /** Figma "Track — cancelled" and "Track — delivery failed / returning". */
    notices: {
      cancelled: 'This order was cancelled',
      cancelledBody:
        'If you paid online, the refund goes back the way you paid within 5–7 working days.',
      failed: 'Delivery failed',
      failedBody:
        'The courier could not deliver it, so the parcel is on its way back to us. Message us to send it again.',
    },
    parcels: {
      title: (count: number) => `Ships in ${count} parcels`,
      note: 'Your order comes from more than one warehouse, so it arrives in separate parcels, each with its own invoice.',
      parcel: (position: number) => `Parcel ${position}`,
      from: (place: string) => `from ${place}`,
      arrives: (range: string) => `Arrives ${range}`,
      onHold: 'Pre-order: ships when it arrives',
      item: (quantity: number, title: string) => `${quantity} × ${title}`,
    },
  },
  addresses: {
    title: 'Addresses',
    add: 'Add address',
    emptyTitle: 'No saved addresses',
    emptyBody: 'Save an address to check out faster next time.',
    default: 'Default',
    makeDefault: 'Set as default',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Delete this address?',
    formAdd: 'New address',
    formEdit: 'Edit address',
    save: 'Save address',
    saving: 'Saving',
    cancel: 'Cancel',
    setDefault: 'Use as my default address',
    fields: {
      name: 'Full name',
      phone: 'Mobile number',
      line1: 'House, building, street',
      line2: 'Area, landmark (optional)',
      city: 'City',
      state: 'State',
      pincode: 'PIN code',
    },
    pincodeHint: 'Six digits, for example 110001',
  },
  profile: {
    title: 'Profile',
    email: 'Email',
    emailNote: 'Your email is how you sign in, so it cannot be changed here.',
    name: 'Name',
    phone: 'Mobile number',
    emailNone: 'You sign in with your mobile number.',
    marketing: 'Email me with news and offers',
    marketingWhatsapp: 'Send me offers on WhatsApp',
    marketingSms: 'Send me offers by SMS',
    marketingHeading: 'Offers and news',
    marketingNote: 'You can change these any time. Order updates are sent either way.',
    save: 'Save',
    saving: 'Saving',
    saved: 'Saved',
  },
  checkout: {
    savedAddresses: 'Saved addresses',
    newAddress: 'Use a new address',
    signedInAs: (who: string) => `Signed in as ${who}`,
    signInRequired: 'Sign in to check out',
    signIn: 'Sign in for faster checkout',
  },
} as const

export const paymentLabels: Record<ShopperPaymentState, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  cod: 'Cash on delivery',
  partly_refunded: 'Partly refunded',
  refunded: 'Refunded',
  failed: 'Payment failed',
}

export const shipmentLabels: Record<ShopperShipmentState, string> = {
  unfulfilled: 'Processing',
  created: 'Ready to ship',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rto: 'Returning to seller',
  cancelled: 'Shipment cancelled',
}

/**
 * Whether the payment pill shows next to an order's status. A cancelled order that was never
 * paid ("Payment pending", "Cash on delivery") has nothing left to pay, so "Cancelled" says it all.
 */
export const paymentPillShown = (status: string, payment: ShopperPaymentState): boolean =>
  !(status === 'cancelled' && (payment === 'pending' || payment === 'cod'))

export const orderStatusLabels = {
  cancelled: 'Cancelled',
} as const

/** Tone of a status pill: positive, neutral or negative. */
export const shipmentTone: Record<ShopperShipmentState, 'good' | 'neutral' | 'bad'> = {
  unfulfilled: 'neutral',
  created: 'neutral',
  picked_up: 'neutral',
  in_transit: 'neutral',
  out_for_delivery: 'neutral',
  delivered: 'good',
  rto: 'bad',
  cancelled: 'bad',
}

/** Dates in the store's own time zone (store.timezone), never the server's. */
export const formatAccountDate = (d: Date | string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(d))

export const formatAccountDateTime = (d: Date | string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(d))
