import { siteConfig } from '@commerce/config/site'
import { PLAN_GST_PERCENT } from '@commerce/core/billing'

const brand = siteConfig.brand.name
const { starter, growth, pro } = siteConfig.plans
const trial = siteConfig.trialDays
const starterWithGst = Math.round(starter.monthlyInr * (1 + PLAN_GST_PERCENT / 100))

export type PlanKey = 'starter' | 'growth' | 'pro'

export type Plan = {
  key: PlanKey
  name: string
  ordersPerMonth: number
  /** Before GST. Yearly is two months free. */
  monthlyInr: number
  yearlyInr: number
  features: readonly string[]
  popular: boolean
}

/** Plans from siteConfig, which mirrors billing (`packages/core/src/billing/plans.ts`). */
export const PLANS: readonly Plan[] = [
  {
    key: 'starter',
    ...starter,
    popular: false,
    features: [
      'Online store, checkout and custom domain',
      'UPI, cards and cash on delivery',
      'GST invoices and Indian couriers',
      `${brand} AI, 500 credits a month`,
    ],
  },
  {
    key: 'growth',
    ...growth,
    popular: true,
    features: [
      `Everything in ${starter.name}`,
      'Shopify theme import',
      'Reviews, Back in stock and Forms apps',
      `${brand} AI, 3,000 credits a month`,
    ],
  },
  {
    key: 'pro',
    ...pro,
    popular: false,
    features: [
      `Everything in ${growth.name}`,
      'Every first-party app included',
      'MCP & API, multiple locations',
      `${brand} AI, 15,000 credits a month`,
    ],
  },
]

/** Days of Growth a new store gets free. */
export const TRIAL_DAYS = trial

export const pricingContent = {
  mostPopular: 'Most popular',
  recommended: 'Recommended for you',
  perMonth: '/month',
  perYear: '/year',
  gstNote: '+ 18% GST',
  withGst: (amount: string, period: string) => `${amount}${period} with GST`,
  yearlyEquivalent: (perMonth: string) => `${perMonth}/month, billed yearly`,
  upTo: 'Up to',
  ordersAMonth: 'orders a month',
  joinShort: 'Start',
  page: {
    eyebrow: 'Pricing',
    title: 'Pay for orders. Not a cut of every sale.',
    subtitle: `Plans by orders a month, no percentage of your revenue. Every store starts with ${trial} days of Growth, no card needed.`,
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: '2 months free',
    billingLabel: 'Billing period',
    feePill: '0% transaction fee',
    calculator: {
      title: 'Find your plan',
      orders: 'Orders a month',
      // Positions along the log-scale slider track, as static classes so Tailwind can see them.
      ordersTicks: [
        { value: 50, at: 'left-0' },
        { value: 100, at: 'left-[18.8%]' },
        { value: 200, at: 'left-[37.6%]' },
        { value: 500, at: 'left-[62.4%]' },
        { value: 1000, at: 'left-[81.2%]' },
        { value: 2000, at: 'left-full' },
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
      subtitle: 'Prices before 18% GST. Orders over the limit are never blocked.',
      plan: 'Plan',
      sticky: 'Sticks while you scroll',
      groups: [
        {
          title: 'Usage',
          rows: [
            { label: 'Orders a month', values: ['50', '200', '1,000'] },
            { label: 'Staff accounts', values: ['2', '5', '15'] },
            { label: `${brand} AI credits a month`, values: ['500', '3,000', '15,000'] },
            { label: 'Storage', values: ['2 GB', '10 GB', '50 GB'] },
          ],
        },
        {
          title: 'Store',
          rows: [
            { label: 'Online store and checkout', values: [true, true, true] },
            { label: 'Custom domain', values: [true, true, true] },
            { label: 'Shopify theme import', values: [false, true, true] },
            { label: 'Hindi admin', values: [true, true, true] },
          ],
        },
        {
          title: 'Selling',
          rows: [
            { label: 'UPI, cards, EMI and COD', values: [true, true, true] },
            { label: 'GST invoices', values: [true, true, true] },
            { label: 'Indian couriers', values: [true, true, true] },
            { label: 'Reviews, Back in stock and Forms', values: [false, true, true] },
            { label: 'Every first-party app', values: [false, false, true] },
            { label: 'MCP & API', values: [false, false, true] },
            { label: 'Multiple locations', values: [false, false, true] },
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
          price: '₹199 per 1,000 credits',
        },
        {
          icon: 'whatsapp',
          title: 'WhatsApp messages',
          body: 'Order updates, COD confirmations and campaigns. Meta bills your own WhatsApp Business account directly.',
          price: 'Meta’s rate, no markup',
        },
        {
          icon: 'seat',
          title: 'Extra orders',
          body: 'Orders are never blocked. Past your limit, until you move up a plan.',
          price: '₹49 per 100 orders',
        },
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
            answer: `No. Prices are before GST; ${PLAN_GST_PERCENT}% GST is added on your bill, with a GST invoice. ${starter.name} is ₹${starterWithGst.toLocaleString('en-IN')} a month with GST.`,
          },
          {
            question: `How does ${brand} make money if it takes 0%?`,
            answer: `From plan fees, paid apps on ${starter.name} and ${growth.name}, and AI credit top-ups. Never from a cut of your sales.`,
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
              'Your store keeps taking orders. Orders are counted per calendar month and reset on the 1st. We tell you before you reach the limit; extra orders cost ₹49 per 100 until you move up.',
          },
          {
            question: 'Can I take my data with me?',
            answer:
              'Yes. Export your products, customers, orders and stock as CSV files from the admin any time. Your data is yours.',
          },
          {
            question: 'Do you offer yearly billing?',
            answer: 'Yes. Paying yearly gets you two months free on every plan.',
          },
        ],
      ],
    },
    cta: {
      title: `Try Growth free for ${trial} days.`,
      body: 'No card needed. Pick a plan when your trial ends.',
    },
  },
}
