import type { ShopperPaymentState, ShopperShipmentState } from '@commerce/core'

/** Every string the shopper account pages show. */
export const accountContent = {
  title: 'Account',
  nav: {
    orders: 'Orders',
    addresses: 'Addresses',
    profile: 'Profile',
    signOut: 'Sign out',
  },
  login: {
    title: 'Sign in',
    intro: 'Enter your email and we will send you a code. No password needed.',
    email: 'Email',
    sendCode: 'Continue',
    sending: 'Sending code',
    codeTitle: 'Enter code',
    codeSent: (email: string) => `We sent a six digit code to ${email}.`,
    code: 'Six digit code',
    verify: 'Sign in',
    verifying: 'Signing in',
    resend: 'Send a new code',
    changeEmail: 'Use a different email',
    guestNote: 'New here? Signing in creates your account. You can still check out as a guest.',
    errors: {
      invalidEmail: 'Enter a valid email address.',
      tooSoon: 'A code was just sent. Wait a few seconds before asking for another.',
      noEmail: 'Sign-in is not available right now. Please try again later.',
      invalid: 'That code is not right. Check the email and try again.',
      expired: 'That code has expired. Ask for a new one.',
      locked: 'Too many attempts. Ask for a new code.',
    },
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
    noEvents: 'The courier has not reported any scans yet.',
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
    marketing: 'Email me with news and offers',
    save: 'Save',
    saving: 'Saving',
    saved: 'Saved',
  },
  checkout: {
    savedAddresses: 'Saved addresses',
    newAddress: 'Use a new address',
    signedInAs: (email: string) => `Signed in as ${email}`,
    signIn: 'Sign in for faster checkout',
  },
} as const

export const paymentLabels: Record<ShopperPaymentState, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  cod: 'Cash on delivery',
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
