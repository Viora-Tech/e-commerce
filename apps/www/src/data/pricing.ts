import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name
const { free, growth, scale } = siteConfig.plans

export type PlanKey = 'free' | 'growth' | 'scale'

export type Plan = {
  key: PlanKey
  name: string
  ordersPerMonth: number
  features: readonly string[]
  popular: boolean
}

/** Plan names and order limits come from siteConfig (placeholders until billing is final). */
export const PLANS: readonly Plan[] = [
  {
    key: 'free',
    name: free.name,
    ordersPerMonth: free.ordersPerMonth,
    popular: false,
    features: [
      'Online store and checkout',
      'UPI, cards and cash on delivery',
      `${brand} AI`,
      'Shopify theme import',
    ],
  },
  {
    key: 'growth',
    name: growth.name,
    ordersPerMonth: growth.ordersPerMonth,
    popular: true,
    features: [
      `Everything in ${free.name}`,
      'Automations',
      'Courier booking and rate compare',
      'Reports and Live view',
    ],
  },
  {
    key: 'scale',
    name: scale.name,
    ordersPerMonth: scale.ordersPerMonth,
    popular: false,
    features: [
      `Everything in ${growth.name}`,
      'Staff accounts and roles',
      'Purchase orders and transfers',
      'Priority support',
    ],
  },
]

export const pricingContent = {
  mostPopular: 'Most popular',
  recommended: 'Recommended for you',
  pricePlaceholder: '₹—',
  perMonth: '/month',
  upTo: 'Up to',
  ordersAMonth: 'orders a month',
  join: 'Join the waitlist',
  joinShort: 'Join',
  page: {
    eyebrow: 'Pricing',
    title: 'Pay for orders. Not a cut of every sale.',
    subtitle:
      'Plans by orders a month — no percentage of your revenue. Prices are announced at launch.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: 'Save —%',
    billingLabel: 'Billing period',
    feePill: '0% transaction fee',
    calculator: {
      title: 'Find your plan',
      orders: 'Orders a month',
      // Positions along the log-scale slider track, as static classes so Tailwind can see them.
      ordersTicks: [
        { value: 50, at: 'left-0' },
        { value: 100, at: 'left-[13.1%]' },
        { value: 500, at: 'left-[43.5%]' },
        { value: 1000, at: 'left-[56.5%]' },
        { value: 5000, at: 'left-[86.9%]' },
        { value: 10000, at: 'left-full' },
      ],
      aov: 'Average order value',
      recommended: 'Recommended for you:',
      keepLabel: 'What you keep',
      platformFee: '~2% platform fee',
      thisPlatform: brand,
      zero: '₹0',
      illustrative: 'Illustrative only. Your payment gateway’s own fee still applies.',
    },
    compare: {
      eyebrow: 'Compare',
      title: 'Every plan, side by side.',
      subtitle: 'Values marked — are not final yet.',
      plan: 'Plan',
      sticky: 'Sticks while you scroll',
      groups: [
        {
          title: 'Usage',
          rows: [
            { label: 'Orders a month', values: ['100', '1,000', '10,000'] },
            { label: 'Staff accounts', values: ['—', '—', '—'] },
            { label: `${brand} AI credits a month`, values: ['—', '—', '—'] },
          ],
        },
        {
          title: 'Store',
          rows: [
            { label: 'Online store and checkout', values: [true, true, true] },
            { label: 'Custom domain', values: [false, true, true] },
            { label: 'Shopify theme import', values: [true, true, true] },
          ],
        },
        {
          title: 'Selling',
          rows: [
            { label: 'UPI, cards, EMI and COD', values: [true, true, true] },
            { label: 'GST invoices', values: [true, true, true] },
            { label: 'WhatsApp updates', values: [false, true, true] },
            { label: 'Automations', values: [false, true, true] },
          ],
        },
        {
          title: 'Support',
          rows: [{ label: 'Support', values: ['Email', 'Email and WhatsApp', 'Priority'] }],
        },
      ],
      included: 'Included',
      notIncluded: 'Not included',
    },
    addOns: {
      eyebrow: 'Add-ons',
      title: 'Top up when you need to.',
      items: [
        {
          icon: 'ai',
          title: 'AI credits',
          body: `More questions and bulk writing with ${brand} AI.`,
        },
        {
          icon: 'whatsapp',
          title: 'WhatsApp packs',
          body: 'Order updates, COD confirmations and campaigns.',
        },
        { icon: 'seat', title: 'Extra staff seats', body: 'Add teammates beyond your plan.' },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Pricing questions',
      columns: [
        [
          {
            question: 'What counts as an order?',
            answer: 'Every checkout that completes on your store, whatever the payment method.',
          },
          {
            question: 'Do you take a cut of my sales?',
            answer: `No. ${brand} takes 0% of your sales on every plan. Your payment gateway’s own fee still applies.`,
          },
          {
            question: 'Is GST included in the price?',
            answer:
              'Prices are announced at launch, with the GST treatment spelled out next to each one.',
          },
        ],
        [
          {
            question: 'Can I change plans later?',
            answer:
              'Yes. Move up or down any time from Settings; the change applies to your next period.',
          },
          {
            question: 'What if I go over my limit?',
            answer:
              'We tell you before you reach it, and you choose whether to move to the next plan.',
          },
          {
            question: 'Do you offer yearly billing?',
            answer: 'Yes, with a discount. The exact saving is announced with the prices.',
          },
        ],
      ],
    },
    cta: {
      title: 'Start free. Upgrade when orders grow.',
      body: 'No card needed to join the waitlist.',
    },
  },
}
