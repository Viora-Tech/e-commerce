import { siteConfig } from '@commerce/config/site'
import { OWN_IT_PRICES, PLAN_GST_PERCENT, type PlanId } from '@commerce/core/billing'
import { formatMoney } from '@commerce/money'

const brand = siteConfig.brand.name
const { starter, growth, pro, scale } = siteConfig.plans
const trial = siteConfig.trialDays
const starterWithGst = Math.round(starter.monthlyInr * (1 + PLAN_GST_PERCENT / 100))
const ownIt = OWN_IT_PRICES.india
const count = (n: number) => n.toLocaleString('en-IN')
/** The paid plans' fee rates, lowest to highest: "0.5–1%". */
const feeRange = `${pro.feePercent}–${starter.feePercent}%`

export type PlanKey = PlanId

export type Plan = {
  key: PlanKey
  name: string
  /** Included a month; each order after that carries `feePercent` of its total. */
  ordersPerMonth: number
  /** Before GST. Yearly is two months free. */
  monthlyInr: number
  yearlyInr: number
  feePercent: number
  /** Fair use; null is judged by hand. */
  visitsPerMonth: number | null
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
      `${brand} AI, 8,000 credits a month`,
    ],
  },
  {
    key: 'scale',
    ...scale,
    popular: false,
    features: [
      `Everything in ${pro.name}`,
      'No per-order fee, ever',
      '25 staff accounts, 100 GB storage',
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
  upTo: 'Includes',
  ordersAMonth: 'orders a month',
  feeAfter: (percent: number) => `Then ${percent}% per order`,
  noFee: 'No per-order fee',
  joinShort: 'Start',
  page: {
    eyebrow: 'Pricing',
    title: 'A low plan. A small fee only as you grow.',
    subtitle: `Every plan includes orders each month. Past them, a small fee per order; on ${scale.name}, none at all. Every store starts with ${trial} days of Growth, no card needed.`,
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: '2 months free',
    billingLabel: 'Billing period',
    feePill: `0% fee on ${scale.name}`,
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
      recommended: 'Cheapest plan for you:',
      costLabel: 'What you pay a month',
      planPrice: (plan: string) => `${plan} plan`,
      perOrderFee: 'Per-order fees',
      twoPercent: 'A 2% fee on the same sales',
      breakdown: (sales: string, orders: string, aov: string) =>
        `On ${sales} in sales (${orders} orders × ${aov}), before 18% GST.`,
      illustrative: 'Illustrative only. Your payment gateway’s own fee still applies.',
    },
    compare: {
      eyebrow: 'Compare',
      title: 'Every plan, side by side.',
      subtitle: 'Prices before 18% GST. Orders are never blocked.',
      plan: 'Plan',
      sticky: 'Sticks while you scroll',
      groups: [
        {
          title: 'Usage',
          rows: [
            { label: 'Orders included a month', values: PLANS.map((p) => count(p.ordersPerMonth)) },
            { label: 'Fee per order after that', values: PLANS.map((p) => `${p.feePercent}%`) },
            {
              label: 'Visits a month (fair use)',
              values: PLANS.map((p) =>
                p.visitsPerMonth === null ? 'Fair use' : count(p.visitsPerMonth),
              ),
            },
            { label: 'Staff accounts', values: ['1', '3', '10', '25'] },
            { label: `${brand} AI credits a month`, values: ['500', '3,000', '8,000', '15,000'] },
            { label: 'Storage', values: ['5 GB', '10 GB', '50 GB', '100 GB'] },
          ],
        },
        {
          title: 'Store',
          rows: [
            { label: 'Online store and checkout', values: [true, true, true, true] },
            { label: 'Custom domain', values: [true, true, true, true] },
            { label: 'Shopify theme import', values: [false, true, true, true] },
            { label: 'Hindi admin', values: [true, true, true, true] },
          ],
        },
        {
          title: 'Selling',
          rows: [
            { label: 'UPI, cards, EMI and COD', values: [true, true, true, true] },
            { label: 'GST invoices', values: [true, true, true, true] },
            { label: 'Indian couriers', values: [true, true, true, true] },
            { label: 'Reviews, Back in stock and Forms', values: [false, true, true, true] },
            { label: 'Every first-party app', values: [false, false, true, true] },
            { label: 'MCP & API', values: [false, false, true, true] },
            { label: 'Multiple locations', values: [false, false, true, true] },
          ],
        },
        {
          title: 'Support',
          rows: [
            { label: 'Support', values: ['Email', 'Email and WhatsApp', 'Priority', 'Priority'] },
          ],
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
          title: 'Orders past your plan',
          body: `Never blocked. A small fee on each order after your included ones, billed on the 1st. None on ${scale.name}.`,
          price: `${feeRange} per order`,
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
            answer:
              'Every order placed on your store, cash on delivery included. Cancelled orders, orders refunded in full and test orders do not count.',
          },
          {
            question: 'Is there a fee on my sales?',
            answer: `Only past your plan’s included orders: ${starter.feePercent}% on ${starter.name}, ${growth.feePercent}% on ${growth.name} and ${pro.feePercent}% on ${pro.name}, of each order’s total. ${scale.name} has no per-order fee at all. Your payment gateway’s own fee still applies.`,
          },
          {
            question: 'How is the per-order fee billed?',
            answer: `Orders are counted per calendar month. On the 1st you get one bill for last month’s fees, with a pay link and a GST invoice; under ₹100, it waits for the next month. Orders during your free trial carry no fee. Your admin shows the running total all month.`,
          },
          {
            question: 'Is GST included in the price?',
            answer: `No. Prices are before GST; ${PLAN_GST_PERCENT}% GST is added on your bill, with a GST invoice. ${starter.name} is ₹${starterWithGst.toLocaleString('en-IN')} a month with GST.`,
          },
          {
            question: `How does ${brand} make money?`,
            answer: `From plan prices, the small per-order fee past your included orders, paid apps on ${starter.name} and ${growth.name}, and AI credit top-ups.`,
          },
        ],
        [
          {
            question: 'Can I change plans later?',
            answer:
              'Yes. Move up or down any time from Settings; the change applies to your next period.',
          },
          {
            question: 'What if I go over my included orders?',
            answer:
              'Your store keeps taking orders. Each one after that carries your plan’s fee, and we tell you at 80% and 100% of your included orders. When a bigger plan works out cheaper, the calculator above shows it.',
          },
          {
            question: 'What does fair use of visits mean?',
            answer: `Each plan suits a number of storefront visits a month (${count(starter.visitsPerMonth ?? 0)} on ${starter.name}). If a store goes past it two months running, we get in touch to find the right plan. Nothing is ever blocked or slowed.`,
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
    ownIt: {
      title: 'Own it',
      body: `Run ${brand} on your own server: no per-order fee, unlimited orders, one brand per licence.`,
      price: `${formatMoney(ownIt.licence, ownIt.currency)} once + ${formatMoney(ownIt.carePerMonth, ownIt.currency)} a month for updates and support`,
      setup: 'Setup on your server ₹7,500, if you want us to do it.',
      action: 'Talk to us',
      href: '/contact',
    },
    cta: {
      title: `Try Growth free for ${trial} days.`,
      body: 'No card needed. Pick a plan when your trial ends.',
    },
  },
}
