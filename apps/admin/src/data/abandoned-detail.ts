import { routes } from '@/lib/routes'

/** Copy for one abandoned checkout (`/orders/abandoned-checkouts/[id]`). */
export const abandonedDetailContent = {
  title: 'Abandoned checkout',
  back: { label: 'Abandoned checkouts' },
  heading: (ref: string) => `Checkout ${ref}`,
  summary: (who: string, left: string, total: string) => `${who} · left ${left} · ${total}`,
  anonymous: 'No contact',
  copyLink: 'Copy cart link',
  linkCopied: 'Cart link copied',
  linkFailed: 'Could not copy the link',
  sendReminder: 'Send reminder',
  sendAgain: 'Send again',
  cart: {
    heading: 'Cart',
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    quantity: (n: number) => `x ${n}`,
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    shippingValue: 'Worked out at checkout',
    total: 'Total',
    empty: 'This cart has no items left',
  },
  customer: {
    heading: 'Customer',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    source: 'Came from',
    none: 'Not given',
  },
  reminder: {
    heading: 'Reminder',
    sub: 'Sent by email and WhatsApp, where the customer has agreed to messages',
    notSent: 'Not sent yet',
    sent: (when: string) => `Sent ${when}`,
    recovered: 'Recovered',
    noEmail: 'This checkout has no email, so a reminder cannot be sent',
    recoveredNote: 'The customer completed this order',
  },
  activity: {
    heading: 'Activity',
    started: 'Started a checkout',
    lastActive: 'Last active in the cart',
    reminded: 'Reminder sent',
    recovered: 'Came back and ordered',
  },
  toasts: {
    sent: (n: number) => (n === 1 ? 'Reminder sent' : `Reminder sent on ${n} channels`),
    failed: 'Could not send the reminder',
  },
  notFound: {
    heading: 'Checkout not found',
    body: 'This checkout does not exist in the current store.',
    action: { label: 'Back to abandoned checkouts', href: routes.orders.abandonedCheckouts() },
  },
} as const
