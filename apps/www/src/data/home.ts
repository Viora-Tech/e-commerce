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
    subline: `Sell anything — physical products, subscriptions, digital downloads and services. Ask ${brand} AI anything, approve every change, take UPI-first payments and ship with the couriers you already use.`,
    tourLinkHref: '#tour',
    globeAlt: 'A dotted globe centred on India',
    floats: {
      ai: {
        label: `${brand} AI · waiting for you`,
        title: 'Raise Abyss Veil price',
        from: '₹2,999',
        to: '₹3,299',
        approve: 'Approve',
        edit: 'Edit',
      },
      order: {
        label: 'Live now',
        title: 'Order #1043 · Bengaluru',
        meta: 'Kabir Singh · ₹3,999 · 2 items',
      },
      upi: { title: 'Paid by UPI', amount: 4499, meta: ' · confirmed automatically' },
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
      'One store for whatever you make — things you ship, plans people renew, files they download and time they book.',
    cards: [
      {
        icon: 'package',
        title: 'Physical products',
        body: 'Variants, stock across locations and courier booking from the order.',
      },
      {
        icon: 'subscriptions',
        title: 'Subscriptions',
        body: 'Plans that renew every week or month, with reminders before each charge.',
      },
      {
        icon: 'downloads',
        title: 'Digital downloads',
        body: 'Courses, templates and files, delivered the moment payment lands.',
      },
      {
        icon: 'services',
        title: 'Services and bookings',
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
        inState: 'Ship to Bengaluru, Karnataka',
        outState: 'Ship to Pune, Maharashtra',
        taxable: 'Taxable value',
        taxableAmount: '₹2,795.76',
        cgst: { label: 'CGST 9%', amount: '₹251.62' },
        sgst: { label: 'SGST 9%', amount: '₹251.62' },
        igst: { label: 'IGST 18%', amount: '₹503.24' },
        total: 'Total',
        totalAmount: '₹3,299',
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
      message: 'You left 2 items in your cart. Complete your order and FIRST900 is applied.',
      cta: 'Complete order',
      delivered: 'Delivered',
    },
    gateways: {
      eyebrow: 'Payment gateways',
      title: 'Razorpay, Cashfree or Decentro',
      body: 'Take UPI, cards and netbanking without sending shoppers away.',
      items: [
        { brand: 'razorpay' as const, name: 'Razorpay', status: 'Connected', connected: true },
        { brand: 'cashfree' as const, name: 'Cashfree', status: 'Available', connected: false },
        { brand: 'decentro' as const, name: 'Decentro', status: 'Available', connected: false },
      ],
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
        { name: 'Abyss Veil', price: '₹3,299' },
        { name: 'Orbit XL', price: '₹2,499' },
        { name: 'Nimbus Skates', price: '₹1,200' },
      ],
    },
  },
  proof: {
    eyebrow: 'Built with and for Indian brands',
    // PLACEHOLDER: replace with a real line from Waimers before launch.
    quote: '“Placeholder quote — replace with a real line from Waimers before launch.”',
    name: 'Waimers',
    meta: 'Gaming glasspads · waimers.in',
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Start free. Grow when you do.',
    subtitle: 'Plans by orders a month. Prices are announced at launch.',
    compare: 'Compare all plans',
    note: 'Plan names and order limits come from the product config and are placeholders until billing is final.',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, answered.',
    items: [
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
    body: 'Join the waitlist and we’ll set up your store with you.',
    email: 'Email us',
  },
}
