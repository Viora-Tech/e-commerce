/** The signed page a draft invoice email's "Pay securely" button opens. */
export const invoiceContent = {
  /** `ref` follows the #: "D12" while the invoice is a draft. */
  pageTitle: (ref: string) => `Invoice #${ref}`,
  intro: (store: string) =>
    `${store} sent you this invoice. Check the items, then pay securely online.`,
  quantity: (n: number) => `Qty ${n}`,
  total: 'Total',
  /** Store credit from the customer's balance the store put towards this invoice. */
  storeCredit: 'Store credit',
  toPay: 'To pay',
  pay: (total: string) => `Pay ${total}`,
  paying: 'Opening secure payment',
  unavailable: 'This invoice link is no longer valid. Ask the store for a new one.',
  busy: 'Too many tries. Wait a minute and try again.',
  noGateway: 'This store cannot take online payments right now. Please contact them to pay.',
  outOfStock: 'Something on this invoice is out of stock now. Please contact the store.',
  noAddress: 'This invoice has no delivery address yet. Please contact the store to add one.',
  /** The store credit on the invoice is no longer on the customer's balance, or pays it all. */
  storeCreditUnusable:
    'The store credit on this invoice cannot be used right now. Please contact the store.',
  back: 'Back to the shop',
} as const
