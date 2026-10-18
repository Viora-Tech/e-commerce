import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name
const docs = siteConfig.urls.docs

export type GuideSection = {
  heading: string
  paragraphs: readonly string[]
  bullets?: readonly string[]
}

export type Guide = {
  slug: string
  title: string
  description: string
  /** ISO dates; `updated` moves when the guide changes. */
  published: string
  updated: string
  readMinutes: number
  sections: readonly GuideSection[]
  /** Where to go next: a solution page or the docs. */
  next: { label: string; href: string }
}

/**
 * Guides for Indian sellers: plain answers to what they search for. General tax points are
 * stated as they are and send readers to their CA for their own case; product steps match the
 * docs.
 */
export const GUIDES: readonly Guide[] = [
  {
    slug: 'move-from-shopify-to-koomerce',
    title: 'How to move your store from Shopify, step by step',
    description: `What comes over from Shopify, how to keep your theme, and the order to do it in so your store never goes dark.`,
    published: '2026-10-18',
    updated: '2026-10-18',
    readMinutes: 6,
    sections: [
      {
        heading: 'Before you start',
        paragraphs: [
          `Moving a store is mostly about not losing anything: products and their images, customers, order history, the URLs Google already knows, and the look your shoppers recognise. ${brand}'s Shopify importer only reads from Shopify, so your Shopify store keeps running untouched until you switch the domain.`,
          'Connect file storage first (Cloudflare R2 or Amazon S3). Without it, product images and files are skipped.',
        ],
      },
      {
        heading: 'What comes over',
        paragraphs: ['Every import is previewed before anything is written. It brings:'],
        bullets: [
          'Products, variants, stock and images',
          'Manual and smart collections',
          'Customers, matched by email and then phone',
          'Orders, as read-only history (no stock change, no messages, no invoices)',
          'Pages, blog posts, menus and URL redirects',
          'Files, metaobjects and metafields',
          'Discounts and gift cards (gift cards get a new code)',
        ],
      },
      {
        heading: 'The order that works',
        paragraphs: [
          'Run a preview and read the report: it shows how many of each thing are new or updated, and what stays in Shopify. Then import. You can leave the page; the import keeps going, and running it again updates instead of duplicating.',
          'Upload your Shopify theme zip next (Growth plan and up). The import report lists every page and section and anything to check. Preview the theme before you publish it.',
          'Connect your payment gateway (Razorpay, Cashfree or Decentro) and a courier (Delhivery, Shiprocket or RapidShyp), place a test order, and only then point your domain at the new store.',
        ],
      },
      {
        heading: 'Keep your Google rankings',
        paragraphs: [
          'Your URL redirects come over with the import, so links people and search engines already have keep working. After the switch, submit the new sitemap in Google Search Console.',
        ],
      },
    ],
    next: { label: 'Shopify alternative for India', href: '/solutions/shopify-alternative-india' },
  },
  {
    slug: 'gst-invoices-for-online-sellers',
    title: 'GST invoices for online sellers in India: a plain guide',
    description:
      'CGST, SGST and IGST, what a tax invoice must show, B2B invoices with the buyer’s GSTIN, credit notes and GSTR-1, explained for people who sell online.',
    published: '2026-10-18',
    updated: '2026-10-18',
    readMinutes: 7,
    sections: [
      {
        heading: 'Which tax applies: CGST, SGST or IGST',
        paragraphs: [
          'GST on a sale depends on where it is supplied. When the buyer is in the same state as you, the tax is split into CGST and SGST. When the buyer is in another state, it is IGST. For an online order, the place of supply is usually the delivery address.',
          'If you ship from warehouses in different states with a GSTIN for each, the invoice is issued under the GSTIN of the warehouse the order ships from.',
        ],
      },
      {
        heading: 'What a tax invoice shows',
        paragraphs: ['A GST tax invoice carries, among other things:'],
        bullets: [
          'Your name, address and GSTIN',
          'A unique invoice number in a consecutive series for the financial year',
          'The date',
          'The buyer’s name and address, and their GSTIN if they are registered',
          'The place of supply',
          'HSN codes, quantities, taxable value, tax rates and the tax amounts',
        ],
      },
      {
        heading: 'B2B orders',
        paragraphs: [
          'A registered business buying from you can claim input tax credit only if their GSTIN is on the invoice. Let business buyers add their GSTIN and business name at checkout, and check the GSTIN’s format so typos are caught.',
        ],
      },
      {
        heading: 'Refunds, advances and returns',
        paragraphs: [
          'When you refund an invoiced order, issue a credit note against the original invoice rather than editing it. If you take payment before the goods exist, such as a pre-order, that is an advance: issue a receipt voucher, then the tax invoice when it ships.',
          'At month end, your sales go into GSTR-1. Exporting it from your invoices saves your CA from retyping them.',
        ],
      },
      {
        heading: `How ${brand} does it`,
        paragraphs: [
          `The GST invoices app turns orders into tax invoices, credit notes, receipt and refund vouchers in your own number series, with the CGST/SGST or IGST split worked out for you, and exports GSTR-1. Every business is different, so check registration and rates for your products with your CA.`,
        ],
      },
    ],
    next: {
      label: 'GST invoices guide in the docs',
      href: `${docs}/merchant-guide/money-and-gst/gst-invoices`,
    },
  },
  {
    slug: 'upi-first-checkout',
    title: 'Why your checkout should put UPI first',
    description:
      'How Indian shoppers pay, why the order of payment options matters, and how to cut cash on delivery returns without turning COD off.',
    published: '2026-10-18',
    updated: '2026-10-18',
    readMinutes: 4,
    sections: [
      {
        heading: 'Shoppers pay the way they pay everywhere else',
        paragraphs: [
          'UPI is how most people in India pay day to day. A checkout that opens on a card form makes them hunt for the option they actually use. Showing UPI first, then cards, EMI, netbanking and cash on delivery, matches what they expect.',
        ],
      },
      {
        heading: 'Keep COD, confirm it',
        paragraphs: [
          'Cash on delivery still matters for first-time buyers. The cost is parcels that come back. Confirming COD orders on WhatsApp before you ship catches many of the orders that would have been refused at the door.',
        ],
      },
      {
        heading: 'A checkout your theme cannot break',
        paragraphs: [
          `In ${brand}, checkout is locked and tested whatever theme you use. You brand it with your logo and colours and choose its fields, and payments go through your own Razorpay, Cashfree or Decentro account.`,
        ],
      },
    ],
    next: { label: 'UPI checkout', href: '/solutions/upi-checkout' },
  },
]

export const guidesContent = {
  eyebrow: 'Guides',
  title: 'Guides for selling online in India.',
  subtitle: 'Plain answers on moving stores, GST, payments and shipping.',
  metaDescription:
    'Plain guides for Indian online sellers: moving from Shopify, GST invoices, UPI checkout, couriers and more.',
  minutes: (n: number) => `${n} min read`,
  updated: (date: string) => `Updated ${date}`,
  next: 'Next',
  rss: 'RSS feed',
}

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug)

export const formatGuideDate = (iso: string) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
