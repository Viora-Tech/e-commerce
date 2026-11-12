import type { ShopperPaymentState } from '@commerce/core'
import type { ChatOrderStatus, ChatPaidBy, ChatTrackStepKey } from '@/lib/chat-track'

/** Copy for "Track my order" inside the chat widget (design: Chat · Track my order). */
export const chatTrackContent = {
  ask: 'Track my order',
  intro: 'Sure. Enter the email or mobile you ordered with, and your order number.',
  introSignedIn: 'Sure. Here are your recent orders. Tap one to see where it is.',
  form: {
    contact: 'Email or mobile',
    contactPlaceholder: 'you@email.com or 98765 43210',
    number: 'Order number',
    numberPlaceholder: '#1042',
    numberHint: 'In your order email, like #1042',
    submit: 'Find my order',
    finding: 'Finding your order',
    notFound: "We couldn't find that order. Check the number and the email or mobile you used.",
    limited: 'Too many tries. Wait a minute, then try again.',
    failed: "We couldn't look that up just now. Try again in a moment.",
    signedInLine: 'Signed in? We show your recent orders straight away, no form.',
    signIn: 'Sign in',
  },
  recent: {
    loading: 'Loading your orders',
    label: 'Your recent orders',
    none: "You haven't placed an order yet. Ordered as a guest? Find it with its number.",
    another: 'Track a different order',
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  },
  card: {
    order: (n: number) => `Order #${n}`,
    placed: (date: string) => `Placed ${date}`,
    paidBy: (method: string) => `Paid by ${method}`,
    qty: (n: number) => `Qty ${n}`,
    more: (n: number) => `+ ${n} more`,
    awb: (waybill: string) => `AWB ${waybill}`,
    expected: (date: string) => `Expected ${date}`,
    deliveredOn: (date: string) => `Delivered ${date}`,
    liveTracking: 'Live tracking',
    viewOrder: 'View order',
    back: 'Back to my orders',
    changeAddress: 'Change delivery address',
    talkToPerson: 'Talk to a person',
    timeline: 'Delivery progress',
    ended: {
      cancelled: 'This order was cancelled.',
      refunded: 'This order was refunded to the way you paid.',
      returning: 'This parcel is on its way back to the store.',
    },
  },
  /** Sent as the shopper when they tap a chip under the card. */
  messages: {
    changeAddress: (n: number) => `I'd like to change the delivery address for order #${n}.`,
    talkToPerson: (n: number) => `I'd like to talk to a person about order #${n}.`,
  },
} as const

export const chatTrackSteps: Record<ChatTrackStepKey, string> = {
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
}

export const chatOrderStatusLabels: Record<ChatOrderStatus, string> = {
  ...chatTrackSteps,
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  returning: 'Returning',
}

export const chatPaidByLabels: Record<ChatPaidBy, string> = {
  upi: 'UPI',
  card: 'card',
  netbanking: 'net banking',
  wallet: 'wallet',
  emi: 'EMI',
  paylater: 'Pay Later',
}

/** The payment part of the card's subline when no method is known. */
export const chatPaymentLabels: Record<ShopperPaymentState, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  cod: 'Cash on delivery',
  partly_refunded: 'Partly refunded',
  refunded: 'Refunded',
  failed: 'Payment failed',
}
