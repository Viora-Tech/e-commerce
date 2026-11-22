import type { TemplateData } from './types'

/**
 * A made-up store look for the dev preview (/dev/emails): socials, a support number and an
 * address, so the header, help box and footer show as they do for a real store. The preview
 * page sets `shopUrl` to the local storefront so the hosted icons load.
 */
export const sampleEmailBrand = {
  supportPhone: '+91 98765 43210',
  address: 'Waimers · Shop 4, Example Market, New Delhi 110001',
  social: [
    { platform: 'instagram', url: 'https://instagram.com/example' },
    { platform: 'youtube', url: 'https://youtube.com/@example' },
    { platform: 'x', url: 'https://x.com/example' },
  ],
}

/**
 * The order on the Figma "Emails" frames (#1042): a made-up shopper, two lines, a code discount,
 * the route ticket and the delivery address. Spread over the base sample by the previews of the
 * order, delivery and payment emails so they look as they do in Figma.
 */
export const figmaOrder = {
  orderNumber: 1042,
  totalLabel: '₹7,018',
  lines: [
    {
      title: 'ATK A9 Wireless Mouse / Blue · Ultimate',
      quantity: 1,
      priceLabel: '₹4,299',
      imageUrl: 'https://placehold.co/132x132/eef4ff/2563eb?text=%20',
    },
    {
      title: 'Glass mousepad / 490 × 420 mm',
      quantity: 1,
      priceLabel: '₹3,499',
      imageUrl: 'https://placehold.co/132x132/f1eefe/6d28d9?text=%20',
    },
  ],
  subtotalLabel: '₹7,798',
  discount: { label: 'Discount (WELCOME10)', amount: '− ₹780' },
  shipping: undefined,
  taxBreakdown: [{ label: 'IGST (18%)', amount: '₹1,070' }],
  paymentMethodLabel: 'UPI',
  paymentState: 'paid',
  route: {
    from: 'New Delhi',
    fromNote: 'Waimers warehouse',
    to: 'Kolkata',
    toNote: 'Asha Verma',
    via: 'Delhivery Surface',
    etaLabel: 'Fri 21 – Sat 22 Nov',
  },
  shipTo: ['Asha Verma', '12 Park Street', 'Kolkata 700016'],
  placedLabel: '19 November 2026',
} satisfies Partial<TemplateData>

/** The GST invoices app's signed order link (made up): the invoice shows as a file with Download. */
export const figmaInvoiceLink = {
  kind: 'invoice' as const,
  label: 'Download invoice',
  url: 'https://waimers.example/documents/order/sample?e=0&t=sample',
}

/** Three made-up products for the "Popular right now" row (welcome and gift card previews). */
export const figmaProducts = [
  {
    title: 'ATK A9 Wireless Mouse',
    priceLabel: '₹4,299',
    url: 'https://waimers.example/products/atk-a9',
    imageUrl: 'https://placehold.co/280x280/eef4ff/2563eb?text=%20',
  },
  {
    title: 'Glass mousepad',
    priceLabel: '₹3,499',
    url: 'https://waimers.example/products/glass-pad',
    imageUrl: 'https://placehold.co/280x280/f1eefe/6d28d9?text=%20',
  },
  {
    title: 'Hall effect keyboard',
    priceLabel: '₹6,999',
    url: 'https://waimers.example/products/he-keyboard',
    imageUrl: 'https://placehold.co/280x280/ecf7ef/15803d?text=%20',
  },
]
