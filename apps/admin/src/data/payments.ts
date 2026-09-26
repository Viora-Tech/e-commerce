/** Copy for Settings → Payments. */
export const paymentsSettingsContent = {
  advancedTitle: 'Advanced payments',
  advancedIntro:
    'Bank transfer and UPI QR you confirm yourself, a fee or discount per method, and what happens to unpaid orders. Connect Razorpay or Cashfree and pick ways to pay on the main Payments page.',
  webhookHint:
    'Webhook URL for the Razorpay dashboard (tick payment.* and refund.* events, plus qr_code.credited and qr_code.closed for auto-confirmed UPI):',
  upiQrHint:
    'Runs on your Razorpay keys: fill them in on the Razorpay card first (Razorpay Checkout itself can stay off). Shoppers get a single-use UPI QR for the exact amount, and the order is marked paid by the Razorpay webhook:',
  unpaid: {
    heading: 'Unpaid orders',
    label: 'Cancel unpaid online orders after (minutes)',
    help: 'Orders paid online that are still unpaid after this long are cancelled and their stock is released. The gateway is checked first, so a late payment is kept. Cash on delivery is never cancelled; UPI or bank transfer orders follow their own rule below. 0 turns this off.',
  },
  transfers: {
    heading: 'Unpaid UPI or bank transfers',
    autoCancel: 'Cancel unpaid transfer orders automatically',
    autoCancelHelp:
      'Off by default, since a customer may have paid before you matched it. Customers are never reminded automatically; send a reminder from the order instead.',
    cancelLabel: 'Cancel after (hours from the order)',
    cancelHelp:
      'You get an email 12 hours before, and the order waits at least that long after it. Marking the order paid stops the cancellation. The customer is told when it is cancelled.',
  },
  preorder: {
    heading: 'Pre-order balance',
    intro:
      'For pre-orders that take a deposit at checkout: when to ask for the rest, how often to remind, and what happens if it is never paid.',
    autoRequest: 'Request the balance automatically',
    autoRequestDays: 'Days before the expected ship date',
    autoRequestHelp:
      'The customer gets an email (and WhatsApp, when set up) with a link to pay. You can always request it by hand from the order.',
    reminders: 'Reminders (days after the request)',
    remindersHelp: 'Up to two, separated by a comma, e.g. 3, 6. Leave empty for none.',
    unpaid: 'If the balance is not paid',
    payWithin: 'Within (days of the request)',
    actions: {
      none: 'Do nothing, I will follow up myself',
      cancel_refund: 'Cancel the order and refund the deposit',
      cancel_keep: 'Cancel the order and keep the deposit',
    } as Record<string, string>,
    keepWarning:
      'Shoppers are told the deposit is non-refundable on the product page and at checkout.',
    save: 'Save',
    saved: 'Pre-order settings saved',
    saveFailed: 'Could not save pre-order settings',
  },
  adjustment: {
    heading: 'Fee or discount',
    typeLabel: 'Type',
    types: [
      { label: 'None', value: 'none' },
      { label: 'Fixed amount (₹)', value: 'fixed' },
      { label: 'Percent of subtotal', value: 'percent' },
    ],
    amountLabel: { fixed: 'Amount in ₹', percent: 'Percent' },
    amountHelp: 'Use a negative number for a discount, e.g. -2 for 2% off.',
    labelLabel: 'Label shown to shoppers',
    labelPlaceholder: { fixed: 'COD handling', percent: 'UPI discount' },
  },
} as const
