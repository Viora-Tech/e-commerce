/** Copy for "Cancel order", taking over an imported order, and the order edit page. */
import { siteConfig } from '@commerce/config/site'

/** The three ways money goes back, shared by the cancel dialog and the edit review. */
export const refundRouteContent = {
  heading: 'Refund',
  original: (via: string) => `Refund to the original payment (${via})`,
  originalHint: 'The money goes back the way the customer paid.',
  manual: 'Mark as refunded by hand',
  manualHint: 'You send the money yourself (UPI, bank transfer, cash). Only recorded here.',
  storeCredit: 'Store credit',
  storeCreditHint:
    'A gift card for the amount is emailed to the customer to use on their next order.',
  none: 'No refund',
  noneHint: 'Nothing goes back now. You can refund later from the payment card.',
  unavailable:
    'This payment was taken on another platform or a gateway that is no longer connected, so it can only be marked as refunded by hand.',
  amount: (amount: string) => `${amount} to refund`,
} as const

export const orderCancelContent = {
  title: 'Cancel this order?',
  body: 'The order closes and cannot be reopened. Cancel any booked courier pickup separately.',
  reason: 'Reason',
  reasonPlaceholder: 'Customer changed their mind, out of stock, fraud...',
  restock: 'Restock items',
  restockHint: 'Put the unsent items back on sale.',
  restockImported:
    'Off by default for an imported order: its stock came from your old store, which had already taken these items out. Turn it on only if they are back on the shelf and not counted yet.',
  notify: 'Notify customer',
  notifyHint: 'Email the customer that the order was cancelled.',
  nothingToRefund: 'Nothing was paid, so there is nothing to refund.',
  confirm: 'Cancel order',
  keep: 'Keep order',
  done: 'Order cancelled',
  failed: 'Could not cancel the order',
} as const

export const orderTakeoverContent = {
  action: `Manage this order in ${siteConfig.brand.name}`,
  hint: 'This order is still open. Take it over to ship, edit or cancel it here.',
  dialogTitle: `Manage this order in ${siteConfig.brand.name}?`,
  dialogBody:
    'It stops being a read-only import: you can book the shipment, mark it fulfilled, edit and cancel it like any order. Stock is not taken again (your old store already counted these items). Its payment stays the old platform’s, so refunds are recorded by hand. This is noted on the timeline and cannot be undone.',
  confirm: `Manage in ${siteConfig.brand.name}`,
  cancel: 'Not now',
  done: 'You can now work on this order here',
  failed: 'Could not take over the order',
  managed: (source: string) => `Imported from ${source}, managed in ${siteConfig.brand.name}`,
  managedBody: 'Taken over from the import: it is shipped, edited and cancelled here now.',
  managedBy: (who: string, when: string) => `Taken over by ${who}, ${when}`,
} as const

export const orderEditContent = {
  action: 'Edit order',
  short: 'Edit',
  /** A variant listed without a price yet (#913): the line starts at ₹0 for you to type one. */
  noPrice: 'No price yet',
  pageTitle: (n: number) => `Edit order #${n}`,
  back: (n: number) => `Order #${n}`,
  intro:
    'Add or remove items, change quantities, prices, shipping or discount. Nothing changes until you review and save.',
  items: 'Items',
  search: 'Search products to add',
  searching: 'Searching…',
  noResults: 'No products match',
  quantity: 'Quantity',
  price: 'Price',
  remove: 'Remove',
  restore: 'Undo',
  packed: (n: number) => `${n} packed: cannot go lower`,
  added: 'Added',
  removed: 'Removed',
  giftCard: 'Gift cards cannot be changed',
  charges: 'Shipping and discount',
  shipping: 'Shipping',
  discount: 'Discount',
  shippingLabel: 'Shipping rate name',
  shippingLabelPlaceholder: 'e.g. Bluedart',
  discountLabel: 'Discount reason',
  discountLabelPlaceholder: 'e.g. UPI discount',
  summary: 'Summary',
  subtotal: 'Subtotal',
  total: 'New total',
  totalWas: (amount: string) => `was ${amount}`,
  paid: 'Paid by customer',
  owed: 'Customer owes',
  owedBack: 'To refund',
  unpaid: 'Not paid yet: the customer pays the new total.',
  review: 'Review changes',
  discard: 'Discard',
  reviewTitle: 'Review the edit',
  loading: 'Working out the new total…',
  reviewBody: (before: string, after: string) => `The total goes from ${before} to ${after}.`,
  noDifference: 'What was paid still matches the total. Nothing to collect or refund.',
  customerOwes: (amount: string) => `The customer owes ${amount} more.`,
  storeOwes: (amount: string) => `You owe the customer ${amount}.`,
  requestPayment: 'Email the customer a payment link',
  requestPaymentHint:
    'They get a link to pay the difference online. You can also collect it by hand from the order page.',
  noEmail: 'The customer has no email address: collect the difference from the order page.',
  note: 'Note for the timeline',
  notePlaceholder: 'Why the order changed (optional)',
  keepEditing: 'Back to editing',
  save: 'Save changes',
  saved: 'Order updated',
  failed: 'Could not update the order',
  notEditable: 'This order can no longer be edited.',
  shippedTitle: 'This order has shipped',
  shippedBody: "Changes won't update the shipment; create a new shipment or return if needed.",
  changes: {
    added: (n: number, name: string) => `Add ${n} × ${name}`,
    removed: (name: string) => `Remove ${name}`,
    changed: (name: string, from: number, to: number) => `${name}: ${from} → ${to}`,
    shipping: (from: string, to: string) => `Shipping ${from} → ${to}`,
    discount: (from: string, to: string) => `Discount ${from} → ${to}`,
    price: (name: string, from: string, to: string) => `${name}: price ${from} → ${to}`,
    shippingLabel: (to: string) =>
      to ? `Shipping rate name: ${to}` : 'Shipping rate name removed',
    discountLabel: (to: string) => (to ? `Discount reason: ${to}` : 'Discount reason removed'),
  },
} as const
