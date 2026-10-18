/** Copy for the order page's "Next step" card (Figma "Order · Next step"). */
export const orderNextStepContent = {
  eyebrow: { next: 'Next step', progress: 'In progress', done: 'Done', closed: 'Closed' },
  upi: {
    title: 'Check the UPI payment',
    body: (amount: string, ago: string) =>
      `${amount} was requested by UPI ${ago}. Match the transfer in your bank app, then mark it as paid.`,
    resend: 'Resend payment link',
    markPaid: 'Mark as paid',
    reminder: 'Reminder',
  },
  collect: {
    title: (amount: string) => `Collect ${amount}`,
    body: 'The payment is still open. Record it here once the money has reached you.',
    action: 'Collect payment',
  },
  ship: {
    title: (n: number) => `Pack and ship ${n} ${n === 1 ? 'item' : 'items'}`,
    cod: (amount: string) =>
      `Cash on delivery: the courier collects ${amount} at the door. Create a shipment to pick the courier and print the label.`,
    paid: (method: string) =>
      `Paid by ${method}. Create a shipment to pick the courier and print the label.`,
    action: 'Fulfil items',
    create: 'Create shipment',
  },
  transit: {
    title: (name: string) => `On its way to ${name}`,
    fallbackName: 'the customer',
    noTracking: 'Marked as shipped. Mark it delivered once it arrives.',
    expected: (date: string) => `expected ${date}`,
    tracking: (waybill: string) => `tracking ${waybill}`,
    copyLink: 'Copy tracking link',
    linkCopied: 'Tracking link copied',
    delivered: 'Mark as delivered',
    steps: {
      picked_up: 'Picked up',
      in_transit: 'In transit',
      out_for_delivery: 'Out for delivery',
      delivered: 'Delivered',
    },
    now: 'Now',
    expectedStep: (date: string) => `Expected ${date}`,
  },
  done: {
    title: (date: string) => `Delivered on ${date}`,
    titleNoDate: 'Delivered',
    body: (name: string, collected: string | null) =>
      `${name} has this order.${collected ? ` The ${collected} cash on delivery was collected.` : ''}`,
    startReturn: 'Start a return',
  },
  cancelled: {
    title: 'This order was cancelled',
    body: 'Nothing more to do here. The history shows what happened.',
    history: 'View history',
  },
} as const
