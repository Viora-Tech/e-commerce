import { siteConfig } from '@commerce/config/site'
import type { BrandKey } from './logos'

const brand = siteConfig.brand.name
const docs = siteConfig.urls.docs

export type TourItem = {
  key: string
  title: string
  description: string
  learnMoreHref: string
  /** An image under /public/images, or the code-built Shopify mock. */
  screen:
    | {
        kind: 'image'
        src: string
        alt: string
        width: number
        height: number
        /** True for flat screenshots that need a browser window around them; the tilted ones already have it. */
        framed: boolean
      }
    | { kind: 'shopify' }
  /** The URL shown in the window chrome for flat screenshots. */
  url: string
  chips: readonly [string, string]
}

export const homeContent = {
  hero: {
    pill: 'For everyone who sells · English and हिन्दी',
    titleLines: ['Run your store', 'in plain words.'],
    subline: `Sell physical products today, with subscriptions, digital downloads and services coming next. Ask ${brand} AI anything, approve every change, take UPI-first payments and ship with the couriers you already use.`,
    tourLinkHref: '#tour',
    below: `Free for ${siteConfig.trialDays} days · no card needed`,
    howItWorks: 'See how it works →',
    globeAlt: 'A dotted globe centred on India',
    floats: {
      ai: {
        label: `${brand} AI · waiting for you`,
        title: 'Raise Veil Glasspad price',
        from: '₹7,499',
        to: '₹7,999',
        approve: 'Approve',
        edit: 'Edit',
      },
      order: {
        label: 'Live now',
        title: 'Order #1043 · Bengaluru',
        meta: 'Kabir Singh · ₹3,748 · 2 items',
      },
      upi: { title: 'Paid by UPI', amount: 7499, meta: ' · confirmed automatically' },
    },
  },
  tour: {
    eyebrow: 'Product tour',
    title: 'Your whole store, in one place.',
    subtitle: `Six things ${brand} does for you every day. Pick one, or let the tour play.`,
    tablistLabel: 'Product tour',
    learnMore: 'Learn more',
    items: [
      {
        key: 'ai',
        title: 'AI assistant',
        description: `Ask ${brand} AI about your store in plain words. It prepares changes; nothing happens until you approve.`,
        learnMoreHref: `${docs}/merchant-guide/home/ask-ai`,
        screen: {
          kind: 'image',
          src: '/images/tour-ai.png',
          alt: 'The Products page with the AI assistant proposing a 5% price change',
          width: 860,
          height: 678,
          framed: false,
        },
        url: `${siteConfig.brand.domain}/admin/products`,
        chips: ['Price change → approved', 'Answered from your products'],
      },
      {
        key: 'live',
        title: 'Live view',
        description: 'Watch orders and visitors arrive on a live globe, the moment they happen.',
        learnMoreHref: `${docs}/merchant-guide/analytics`,
        screen: {
          kind: 'image',
          src: '/images/screen-orders.png',
          alt: 'The Orders page with every order, payment and next step',
          width: 696,
          height: 498,
          framed: true,
        },
        url: `${siteConfig.brand.domain}/admin/orders`,
        chips: ['Order #1043 · Bengaluru', 'Paid by UPI'],
      },
      {
        key: 'automations',
        title: 'Automations',
        description: 'Set up follow-ups once. WhatsApp and email messages go out on their own.',
        learnMoreHref: `${docs}/merchant-guide/growth/automations`,
        screen: {
          kind: 'image',
          src: '/images/tour-automations.png',
          alt: 'The Automations page with a WhatsApp follow-up flow',
          width: 860,
          height: 678,
          framed: false,
        },
        url: `${siteConfig.brand.domain}/admin/growth/automations`,
        chips: ['WhatsApp sent · 2m ago', '412 entered this month'],
      },
      {
        key: 'theme',
        title: 'Theme import',
        description:
          'Upload your Shopify theme zip. We copy the look and run it on our own cart and checkout.',
        learnMoreHref: `${docs}/merchant-guide/online-store/import-a-shopify-theme`,
        screen: { kind: 'shopify' },
        url: `${siteConfig.brand.domain}/admin/themes`,
        chips: ['Look copied exactly', 'Changes explained in plain words'],
      },
      {
        key: 'checkout',
        title: 'Checkout',
        description: 'UPI on top, then cards, EMI, netbanking and cash on delivery.',
        learnMoreHref: `${docs}/merchant-guide/money-and-gst/payments`,
        screen: {
          kind: 'image',
          src: '/images/tour-checkout.png',
          alt: 'The checkout page with UPI selected',
          width: 860,
          height: 678,
          framed: false,
        },
        url: `${siteConfig.brand.domain}/checkout`,
        chips: ['Paid via UPI · ₹7,598', 'FIRST900 applied'],
      },
      {
        key: 'shipping',
        title: 'Shipping',
        description:
          'Compare Delhivery, Shiprocket and RapidShyp rates and book a pickup from the order.',
        learnMoreHref: `${docs}/merchant-guide/apps/couriers`,
        screen: {
          kind: 'image',
          src: '/images/screen-stock.png',
          alt: 'The admin with stock levels and shipments',
          width: 805,
          height: 465,
          framed: true,
        },
        url: `${siteConfig.brand.domain}/admin/orders`,
        chips: ['3 couriers compared', 'Label ready to print'],
      },
    ] satisfies readonly TourItem[],
  },
  sell: {
    eyebrow: 'For everyone',
    title: 'Sell anything. To anyone.',
    subtitle:
      'One store for whatever you make. Things you ship work today; plans people renew, files they download and time they book are coming next.',
    soon: 'Coming soon',
    cards: [
      {
        icon: 'package',
        title: 'Physical products',
        body: 'Variants, stock across locations and courier booking from the order.',
      },
      {
        icon: 'subscriptions',
        title: 'Subscriptions',
        soon: true,
        body: 'Plans that renew every week or month, with reminders before each charge.',
      },
      {
        icon: 'downloads',
        title: 'Digital downloads',
        soon: true,
        body: 'Courses, templates and files, delivered the moment payment lands.',
      },
      {
        icon: 'services',
        title: 'Services and bookings',
        soon: true,
        body: 'Sell your time — sessions, classes and appointments with a slot picker.',
      },
    ],
  },
  india: {
    eyebrow: 'Made for India',
    title: 'Built for how India buys.',
    subtitle: 'UPI, GST, cash on delivery, Indian couriers and हिन्दी — built in, not bolted on.',
    payments: {
      eyebrow: 'Payments',
      title: 'UPI-first checkout',
      body: 'UPI on top, then cards, EMI, netbanking and cash on delivery — in a checkout themes can’t break.',
    },
    gst: {
      eyebrow: 'Taxes',
      title: 'GST done right',
      body: 'CGST and SGST inside your state, IGST across states — on invoices per GST number.',
      badge: 'Invoices per GSTIN',
      invoice: {
        title: 'Tax invoice',
        number: 'INV-1043',
        gstin: 'GSTIN 29ABCDE1234F1Z5 · Karnataka',
        item: 'ATK A9 Wireless Mouse × 1',
        inState: 'Ship to Bengaluru, Karnataka',
        outState: 'Ship to Pune, Maharashtra',
        taxable: 'Taxable value',
        taxableAmount: '₹2,541.53',
        cgst: { label: 'CGST 9%', amount: '₹228.74' },
        sgst: { label: 'SGST 9%', amount: '₹228.73' },
        igst: { label: 'IGST 18%', amount: '₹457.47' },
        total: 'Total',
        totalAmount: '₹2,999',
      },
    },
    couriers: {
      eyebrow: 'Shipping',
      title: 'Ship with Delhivery, Shiprocket and RapidShyp',
      body: 'Compare rates and book a pickup from the order.',
      badge: 'PIN 560038 serviceable',
      route: 'Pickup to delivery',
      options: [
        {
          code: 'DL',
          brand: 'delhivery' as const,
          name: 'Delhivery · Surface',
          eta: 'Delivery by Sat, 18 Oct · COD',
          price: '₹96',
          selected: true,
        },
        {
          code: 'SR',
          brand: 'shiprocket' as const,
          name: 'Shiprocket · Air',
          eta: 'Delivery by Fri, 17 Oct · COD',
          price: '₹118',
          selected: false,
        },
        {
          code: 'RS',
          brand: 'rapidshyp' as const,
          name: 'RapidShyp · Surface',
          eta: 'Delivery by Sun, 19 Oct',
          price: '₹89',
          selected: false,
        },
      ],
      inclGst: 'incl. GST',
    },
    hindi: {
      eyebrow: 'Languages',
      title: 'Your admin in हिन्दी',
      body: 'Switch any time. Same store, same data.',
      english: { title: '4 items low on stock', body: 'Restock soon so they keep selling.' },
      hindi: { title: '4 आइटम का स्टॉक कम', body: 'जल्दी रीस्टॉक करें ताकि ये बिकते रहें।' },
      toggle: ['EN', 'हि'],
    },
    recovery: {
      eyebrow: 'Recovery',
      title: 'Win back abandoned carts on WhatsApp',
      body: 'A friendly reminder with the cart and a nudge, sent automatically to shoppers who said yes.',
      when: 'Sent 30 minutes after checkout',
      message:
        'You left the ATK A9 Wireless Mouse in your cart. Complete your order and FIRST900 is applied.',
      cta: 'Complete order',
      delivered: 'Delivered',
    },
    gateways: {
      eyebrow: 'Payment gateways',
      title: 'Razorpay, Cashfree or Decentro',
      body: 'Take UPI, cards and netbanking without sending shoppers away.',
      items: [
        {
          brand: 'razorpay' as const,
          name: 'Razorpay',
          methods: ['UPI', 'Cards', 'EMI', 'Netbanking'],
          status: 'Connected',
          connected: true,
        },
        {
          brand: 'cashfree' as const,
          name: 'Cashfree',
          methods: ['UPI', 'Cards', 'Pay later', 'Netbanking'],
          status: 'Available',
          connected: false,
        },
        {
          brand: 'decentro' as const,
          name: 'Decentro',
          methods: ['UPI', 'UPI QR'],
          status: 'Available',
          connected: false,
        },
      ],
      note: 'Switch gateways any time. Your checkout, orders and refunds stay the same.',
    },
  },
  integrations: {
    eyebrow: 'Works with the tools you already use',
    items: [
      'razorpay',
      'cashfree',
      'decentro',
      'upi',
      'phonepe',
      'googlepay',
      'paytm',
      'delhivery',
      'shiprocket',
      'rapidshyp',
      'whatsapp',
      'shopify',
    ] satisfies readonly BrandKey[],
  },
  shopify: {
    eyebrow: 'Bring your Shopify theme',
    title: 'Upload your theme. Keep your look.',
    subtitle:
      'Upload the theme zip Shopify emails you. We copy the look exactly and run every function on our own cart, checkout, GST and couriers — and tell you in plain words what changed.',
    zip: 'theme.zip',
    files: ['sections/', 'templates/', 'assets/'],
    before: { caption: 'On Shopify', url: 'waimers.myshopify.com' },
    after: { caption: `On ${brand} — same look`, url: `waimers.${siteConfig.brand.domain}` },
    store: {
      name: 'WAIMERS',
      headline: 'Glass that glides.',
      cta: 'Shop glasspads',
      products: [
        { name: 'ATK A9 Mouse', price: '₹2,999' },
        { name: 'Veil Glasspad', price: '₹7,499' },
        { name: 'Dot Skates', price: '₹749' },
      ],
    },
  },
  proof: {
    eyebrow: 'Built with and for Indian brands',
    // A plain fact until Waimers gives a line we can quote; never write one for them.
    live: 'Running live on',
    name: 'Waimers',
    meta: 'Gaming mice and desk gear',
    href: 'https://waimers.in',
    domain: 'waimers.in',
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pay for orders, not a cut of sales.',
    subtitle: `Plans from ₹${siteConfig.plans.starter.monthlyInr.toLocaleString('en-IN')} a month, before GST. Every store starts with ${siteConfig.trialDays} days of Growth free.`,
    compare: 'Compare all plans',
    note: 'Prices before 18% GST. Yearly billing gets two months free.',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, answered.',
    items: [
      {
        question: 'How do I start?',
        answer: `Sign in with Google and create your store in a few minutes. Every store gets ${siteConfig.trialDays} days of Growth free, no card needed.`,
      },
      {
        question: 'Can I move my Shopify store?',
        answer:
          'Yes. Import your products, customers and orders, and upload your Shopify theme zip. We keep the look and run it on our own cart, checkout and couriers.',
      },
      {
        question: 'Does the AI change things on its own?',
        answer: `No. ${brand} AI prepares a change and shows exactly what will happen. Nothing is saved until you approve it, and you can undo it afterwards.`,
      },
      {
        question: 'Which payment methods are supported?',
        answer:
          'UPI first, then cards, EMI, netbanking and cash on delivery, through Razorpay, Cashfree or Decentro.',
      },
      {
        question: 'How do I control cash on delivery?',
        answer:
          'Block COD for PIN codes that return too often, cap the order value COD is offered for, add a COD fee, and confirm COD orders on WhatsApp before you ship.',
      },
      {
        question: 'Which couriers can I use?',
        answer:
          'Delhivery, Shiprocket and RapidShyp. Compare rates and book a pickup from the order.',
      },
      {
        question: 'Is the admin available in Hindi?',
        answer: 'Yes. Switch the admin between English and हिन्दी any time. Same store, same data.',
      },
    ],
  },
  cta: {
    title: 'Run your store in plain words.',
    body: `Sign up in a minute and get ${siteConfig.trialDays} days of Growth free, no card needed.`,
    email: 'Email us',
  },
}
