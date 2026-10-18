import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name
const docs = siteConfig.urls.docs
const { starter, growth } = siteConfig.plans
const trial = siteConfig.trialDays

export type Solution = {
  slug: string
  /** The page title in search results (the brand is added after it). */
  metaTitle: string
  description: string
  eyebrow: string
  title: string
  lead: string
  points: readonly { title: string; body: string }[]
  faq: readonly { question: string; answer: string }[]
  guide: { label: string; href: string }
  related: readonly string[]
}

/**
 * Landing pages for what Indian sellers search for, one per need. Every claim here is something
 * the product does today (the features page and the docs say the same).
 */
export const SOLUTIONS: readonly Solution[] = [
  {
    slug: 'shopify-alternative-india',
    metaTitle: 'Shopify alternative for India',
    description: `${brand} is an e-commerce platform built for India: UPI-first checkout, GST invoices, Indian couriers and a Hindi admin, with 0% transaction fee. Move from Shopify with your theme.`,
    eyebrow: 'Shopify alternative',
    title: 'The Shopify alternative built for how India sells.',
    lead: `Keep your Shopify look, bring your products, customers and orders, and run them on a store made for UPI, GST and Indian couriers. ${brand} takes 0% of your sales.`,
    points: [
      {
        title: 'Bring everything over',
        body: 'The Shopify importer copies products, collections, customers, orders, pages, blog posts, menus, redirects, discounts and gift cards. It only reads from Shopify, and every import is previewed first.',
      },
      {
        title: 'Keep your theme',
        body: 'Upload your Shopify theme zip and your store keeps its look, running on our cart, checkout and couriers.',
      },
      {
        title: 'India built in, not bolted on',
        body: 'UPI-first checkout through Razorpay, Cashfree or Decentro, GST invoices per GSTIN, and Delhivery, Shiprocket and RapidShyp in the same admin.',
      },
      {
        title: 'Pay for orders, not a cut',
        body: `Plans start at ₹${starter.monthlyInr.toLocaleString('en-IN')} a month before GST, with 0% transaction fee. Your payment gateway’s own fee still applies.`,
      },
    ],
    faq: [
      {
        question: 'Will my Shopify store change when I import?',
        answer:
          'No. The importer only reads from Shopify. Run it again any time; it updates what it brought over instead of making copies.',
      },
      {
        question: 'Can I keep my Shopify theme?',
        answer: `Yes, from the ${growth.name} plan. Upload the theme zip; the import report shows what was kept and anything to check.`,
      },
      {
        question: 'Do you charge a transaction fee?',
        answer: `No. ${brand} takes 0% of your sales on every plan.`,
      },
    ],
    guide: {
      label: 'Move your store from Shopify',
      href: `${docs}/merchant-guide/start-here/move-from-shopify`,
    },
    related: ['shopify-theme-import', 'upi-checkout', 'gst-invoicing'],
  },
  {
    slug: 'gst-invoicing',
    metaTitle: 'GST invoices for your online store',
    description:
      'Issue GST tax invoices, credit notes and receipt vouchers from your orders, with the CGST/SGST or IGST split, buyer GSTIN for B2B and GSTR-1 export for your CA.',
    eyebrow: 'GST invoicing',
    title: 'GST invoices from every order, without typing them.',
    lead: 'Every order becomes a proper tax invoice with your GSTIN, the buyer’s state, HSN codes and the right tax split, numbered in your own series.',
    points: [
      {
        title: 'The right split, every time',
        body: 'CGST and SGST when the buyer is in your state, IGST when they are not, worked out from the place of supply.',
      },
      {
        title: 'B2B invoices',
        body: 'Shoppers can add their GSTIN at checkout, so business customers get an invoice they can claim input tax credit on.',
      },
      {
        title: 'Refunds and advances',
        body: 'A refund makes a credit note against the invoice. A paid pre-order gets a receipt voucher first and its tax invoice when it ships.',
      },
      {
        title: 'Ready for your CA',
        body: 'Several GST numbers and warehouses are supported. Download invoices in bulk and export a GSTR-1 file at month end.',
      },
    ],
    faq: [
      {
        question: 'Do I need a GSTIN to sell?',
        answer:
          'That depends on your business; ask your CA. If you have one, add it in Settings and every invoice carries it.',
      },
      {
        question: 'Can I have invoices for more than one GST number?',
        answer:
          'Yes. Each warehouse can belong to its own GSTIN, and orders are invoiced under the one they ship from.',
      },
      {
        question: 'Can I export GSTR-1?',
        answer: 'Yes. The GST invoices app exports a GSTR-1 file for the month.',
      },
    ],
    guide: {
      label: 'GST invoices guide',
      href: `${docs}/merchant-guide/money-and-gst/gst-invoices`,
    },
    related: ['upi-checkout', 'indian-couriers', 'shopify-alternative-india'],
  },
  {
    slug: 'upi-checkout',
    metaTitle: 'UPI checkout for your online store',
    description:
      'A checkout with UPI on top, then cards, EMI, netbanking and cash on delivery, through Razorpay, Cashfree or Decentro. COD orders confirmed on WhatsApp before you ship.',
    eyebrow: 'UPI checkout',
    title: 'A checkout that puts UPI first.',
    lead: 'Most Indian shoppers pay with UPI. Your checkout shows it on top, then cards, EMI, netbanking and cash on delivery.',
    points: [
      {
        title: 'Your gateway, your money',
        body: 'Connect Razorpay, Cashfree or Decentro. Payments go to your own gateway account.',
      },
      {
        title: 'COD you can trust',
        body: 'Cash on delivery orders can be confirmed on WhatsApp before you ship, so fewer parcels come back.',
      },
      {
        title: 'A checkout themes cannot break',
        body: 'Checkout is locked and tested, whatever theme your store uses. You set the logo, colours and fields.',
      },
    ],
    faq: [
      {
        question: 'Which payment gateways work?',
        answer: 'Razorpay, Cashfree and Decentro. You connect your own account in a short dialog.',
      },
      {
        question: 'Can I offer cash on delivery?',
        answer: 'Yes, alongside UPI, cards, EMI and netbanking.',
      },
      {
        question: `Does ${brand} take a cut of payments?`,
        answer: 'No. 0% transaction fee on every plan; only your gateway’s fee applies.',
      },
    ],
    guide: { label: 'Payments guide', href: `${docs}/merchant-guide/money-and-gst/payments` },
    related: ['gst-invoicing', 'indian-couriers', 'shopify-alternative-india'],
  },
  {
    slug: 'indian-couriers',
    metaTitle: 'Delhivery, Shiprocket and RapidShyp in one admin',
    description:
      'Compare courier rates for a PIN code, book the pickup from the order and print the label. Delhivery, Shiprocket and RapidShyp built in, with tracking back on the order.',
    eyebrow: 'Shipping',
    title: 'Compare couriers, book, print. From the order.',
    lead: 'Delhivery, Shiprocket and RapidShyp are built in. Pick the best rate for the PIN code and ship without leaving the order.',
    points: [
      {
        title: 'Rates side by side',
        body: 'See what each courier charges for the parcel and the PIN code before you book.',
      },
      {
        title: 'One click to ship',
        body: 'Create the shipment, book the pickup and print the label from the order page.',
      },
      {
        title: 'Tracking that flows back',
        body: 'Tracking is checked every 30 minutes, or straight away where the courier sends updates, and lands on the order.',
      },
    ],
    faq: [
      {
        question: 'Which couriers can I use?',
        answer: 'Delhivery, Shiprocket and RapidShyp, each with your own account.',
      },
      {
        question: 'Can I ship from more than one warehouse?',
        answer:
          'Yes. Stock is kept per location, and each shipment goes from the location you choose.',
      },
    ],
    guide: { label: 'Shipments guide', href: `${docs}/merchant-guide/orders/shipments` },
    related: ['gst-invoicing', 'upi-checkout', 'hindi-ecommerce-admin'],
  },
  {
    slug: 'hindi-ecommerce-admin',
    metaTitle: 'E-commerce admin in Hindi',
    description: `Run your online store in हिन्दी. Switch the ${brand} admin between English and Hindi any time: same store, same data, and AI that writes in both.`,
    eyebrow: 'Hindi admin',
    title: 'Run your store in हिन्दी.',
    lead: 'Switch the whole admin between English and Hindi any time. Your team works in the language they think in.',
    points: [
      {
        title: 'Every page, both languages',
        body: 'Orders, products, stock, settings and reports read in Hindi, with the same store and data underneath.',
      },
      {
        title: 'Per person',
        body: 'Each person picks their own language, so one teammate can work in Hindi while another uses English.',
      },
      {
        title: 'AI in both',
        body: `${brand} AI answers in the language you ask in, and bulk Write with AI writes product copy in English or Hindi.`,
      },
    ],
    faq: [
      {
        question: 'Does the storefront change language too?',
        answer: 'No. The admin language is yours; your store shows the language you write it in.',
      },
      {
        question: 'Is Hindi on every plan?',
        answer: 'Yes.',
      },
    ],
    guide: { label: 'Admin language guide', href: `${docs}/merchant-guide/settings/language` },
    related: ['ai-for-ecommerce', 'shopify-alternative-india', 'indian-couriers'],
  },
  {
    slug: 'shopify-theme-import',
    metaTitle: 'Import your Shopify theme',
    description:
      'Upload your Shopify theme zip and keep your store’s look, running on our cart, checkout and couriers. A report shows every section and anything to check.',
    eyebrow: 'Theme import',
    title: 'Your Shopify theme, on a store made for India.',
    lead: 'Upload the theme zip. Your pages keep their look, and run on our own cart, checkout, couriers and GST.',
    points: [
      {
        title: 'Upload and go',
        body: 'Export your theme from Shopify, upload the zip, and preview it before it goes live.',
      },
      {
        title: 'A report you can read',
        body: 'The import report lists every page and section, what was kept, and anything to look at.',
      },
      {
        title: 'Edit it after',
        body: 'Change settings in the theme editor, or open the files in Edit code. Code saves stay drafts until you publish.',
      },
    ],
    faq: [
      {
        question: 'Which plans include theme import?',
        answer: `${growth.name} and Pro. Every new store gets ${trial} days of ${growth.name} free to try it.`,
      },
      {
        question: 'Does checkout use my theme?',
        answer:
          'No. Checkout stays our locked, tested checkout with your logo and colours, so a theme can never break it.',
      },
    ],
    guide: {
      label: 'Import a Shopify theme',
      href: `${docs}/merchant-guide/online-store/import-a-shopify-theme`,
    },
    related: ['shopify-alternative-india', 'upi-checkout', 'ai-for-ecommerce'],
  },
  {
    slug: 'ai-for-ecommerce',
    metaTitle: 'AI for your online store',
    description: `${brand} AI answers questions from your own store data, prepares changes for you to approve, and writes product copy in bulk, in English and Hindi.`,
    eyebrow: 'AI',
    title: 'Ask your store. Approve every change.',
    lead: `${brand} AI is on every admin page. Ask in plain words; it answers from your own data and prepares changes you approve.`,
    points: [
      {
        title: 'Answers from your data',
        body: 'Ask which products sold most last week or which orders are waiting to ship, and get the answer with where it came from.',
      },
      {
        title: 'Nothing changes on its own',
        body: 'It shows exactly what will happen. Nothing is saved until you approve it, and you can undo it afterwards.',
      },
      {
        title: 'Write with AI, in bulk',
        body: 'Product titles, descriptions and SEO for hundreds of products at once, in English or Hindi, reviewed before they save.',
      },
    ],
    faq: [
      {
        question: 'How is AI use counted?',
        answer:
          'In credits, from the work each answer takes. Every plan includes credits each month, and you can top up 1,000 credits for ₹199.',
      },
      {
        question: 'Does the AI change my store by itself?',
        answer: 'No. Every change waits for your approval.',
      },
    ],
    guide: { label: 'Ask AI guide', href: `${docs}/merchant-guide/home/ask-ai` },
    related: ['hindi-ecommerce-admin', 'shopify-theme-import', 'shopify-alternative-india'],
  },
]

export const solutionsContent = {
  eyebrow: 'Solutions',
  title: 'What do you need your store to do?',
  subtitle: `Each page shows how ${brand} handles one part of selling in India.`,
  metaDescription: `How ${brand} handles UPI checkout, GST invoices, Indian couriers, Shopify theme import, a Hindi admin and AI for Indian online stores.`,
  readGuide: 'Read the guide',
  related: 'Related',
  faqTitle: 'Questions',
  cta: {
    title: `Try ${growth.name} free for ${trial} days.`,
    body: 'No card needed. Join the waitlist and we’ll set up your store with you.',
  },
}

export const solutionBySlug = (slug: string) => SOLUTIONS.find((s) => s.slug === slug)
