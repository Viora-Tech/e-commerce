/** Copy for the guest order lookup (Figma Pages · Track order). */
export const trackOrderContent = {
  metaTitle: 'Track your order',
  title: 'Track your order',
  body: 'Enter your order number and the email or mobile number you used at checkout.',
  number: 'Order number',
  numberPlaceholder: '#1042',
  contact: 'Email or mobile number',
  contactPlaceholder: 'you@email.com or 98765 43210',
  submit: 'Track order',
  checking: 'Finding your order',
  notFound:
    'We could not find an order with those details. Check the number on your confirmation email and try again.',
  limited: 'Too many tries. Wait a minute and try again.',
  account: 'Have an account?',
  signIn: 'Sign in to see all orders',
  /** Signed in: the shopper's latest orders above the lookup, as Shopify's order status page. */
  recent: {
    intro: 'Your latest orders. Open one to see where it is.',
    viewAll: 'View all orders',
  },
  /** Signed in: the lookup form under the recent orders. */
  another: {
    title: 'Track another order',
    body: 'Placed as a guest or with another email or mobile? Enter its number and the details you used.',
  },
} as const

/** How many of a signed-in shopper's orders the page lists; the rest are on `/account`. */
export const RECENT_ORDERS_LIMIT = 5
