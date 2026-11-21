import { siteConfig } from '@commerce/config/site'
import type { PerformanceReport } from './report-types'

/**
 * Made-up reports for the email previews and tests, the figures from the agreed Figma frames
 * (19 Nov 2026). Product images stay empty so a preview never loads a store's own files.
 */
const admin = `https://admin.${siteConfig.brand.domain}`
const up = (label: string) => ({ label: `▲ ${label}`, up: true })
const down = (label: string) => ({ label: `▼ ${label}`, up: false })
const sellers = (rows: [string, string, string, string][]) =>
  rows.map(([title, detail, soldLabel, amountLabel]) => ({
    title,
    detail,
    soldLabel,
    amountLabel,
    imageUrl: null,
  }))
const common = {
  button: { label: 'Open your analytics', url: `${admin}/analytics` },
  analyticsUrl: `${admin}/analytics`,
  settingsUrl: `${admin}/account/notifications`,
  sources: [
    { label: 'Instagram', percent: 62 },
    { label: 'Google', percent: 21 },
    { label: 'Direct', percent: 12 },
    { label: 'WhatsApp', percent: 5 },
  ],
}

export const sampleWeeklyReport: PerformanceReport = {
  ...common,
  period: 'weekly',
  kicker: 'Weekly report · Week 46',
  title: 'Your week at Waimers.',
  periodLabel: 'Monday 10 – Sunday 16 November',
  netLabel: '₹1,84,320',
  change: up('18%'),
  changeNote: 'vs ₹1,56,220 last week · your best week in a month',
  bars: [
    ['Mon', 18],
    ['Tue', 22],
    ['Wed', 15],
    ['Thu', 26],
    ['Fri', 31],
    ['Sat', 42],
    ['Sun', 30],
  ].map(([label, k]) => ({
    label: String(label),
    valueLabel: `₹${k}k`,
    value: Number(k),
    best: label === 'Sat',
  })),
  barNote: 'Saturday was your best day: 22 orders worth ₹42,100.',
  stats: [
    { label: 'Orders', value: '96', change: up('14%') },
    { label: 'Visitors', value: '4,210', change: down('3%') },
    { label: 'Conversion', value: '2.3%', change: up('0.4 pt') },
    { label: 'Average order', value: '₹1,920', change: up('3%') },
    { label: 'New customers', value: '38', change: up('23%') },
    { label: 'Repeat buyers', value: '24%', change: down('2 pt') },
  ],
  vsLabel: 'vs last week',
  historyTitle: 'Your last five weeks',
  history: [
    { label: '19 Oct', value: '₹1.21L' },
    { label: '26 Oct', value: '₹1.38L' },
    { label: '2 Nov', value: '₹1.12L' },
    { label: '9 Nov', value: '₹1.56L' },
    { label: 'This week', value: '₹1.84L' },
  ],
  sellersTitle: 'Your top sellers',
  sellers: sellers([
    ['Wireless mouse', 'Blue', '31 sold', '₹40,300'],
    ['Glass mousepad', '490 × 420 mm', '18 sold', '₹32,400'],
    ['Mechanical keyboard', 'Ocean Blue', '22 sold', '₹15,400'],
  ]),
  todoTitle: 'Worth a look this week',
  todos: [
    {
      icon: '🛒',
      text: '41 carts were left at checkout, worth ₹78,600.',
      linkLabel: 'Send a reminder',
      url: `${admin}/orders/abandoned-checkouts`,
    },
    {
      icon: '📦',
      text: '3 of your top sellers are almost sold out.',
      linkLabel: 'See stock',
      url: `${admin}/stock`,
    },
  ],
  todosFirst: false,
  moneyTitle: 'Money this week',
  money: [
    { label: 'Gross sales', amount: '₹1,96,800' },
    { label: 'Discounts', amount: '− ₹8,280' },
    { label: 'Refunds', amount: '− ₹4,200' },
  ],
  footer: 'Sent every Monday at 9:00 to staff who turned on the weekly report.',
}

export const sampleMonthlyReport: PerformanceReport = {
  ...sampleWeeklyReport,
  period: 'monthly',
  kicker: 'Monthly report · October 2026',
  title: 'Your October at Waimers.',
  periodLabel: 'Wednesday 1 – Friday 31 October',
  netLabel: '₹6,42,800',
  change: up('9%'),
  changeNote: 'vs ₹5,89,700 in September',
  bars: [
    ['1–5 Oct', 82, '₹82k'],
    ['6–12', 121, '₹1.21L'],
    ['13–19', 196, '₹1.96L'],
    ['20–26', 138, '₹1.38L'],
    ['27–31', 105, '₹1.05L'],
  ].map(([label, value, valueLabel]) => ({
    label: String(label),
    value: Number(value),
    valueLabel: String(valueLabel),
    best: label === '13–19',
  })),
  barNote: '13–19 October was your best week: ₹1,96,000 from 104 orders.',
  stats: [
    { label: 'Orders', value: '342', change: up('11%') },
    { label: 'Visitors', value: '15,880', change: up('6%') },
    { label: 'Conversion', value: '2.2%', change: up('0.1 pt') },
    { label: 'Average order', value: '₹1,880', change: down('2%') },
    { label: 'New customers', value: '141', change: up('18%') },
    { label: 'Repeat buyers', value: '27%', change: up('3 pt') },
  ],
  vsLabel: 'vs September',
  historyTitle: 'Your last six months',
  history: [
    { label: 'May', value: '₹4.1L' },
    { label: 'Jun', value: '₹3.8L' },
    { label: 'Jul', value: '₹4.6L' },
    { label: 'Aug', value: '₹5.2L' },
    { label: 'Sep', value: '₹5.9L' },
    { label: 'October', value: '₹6.4L' },
  ],
  sellersTitle: 'Your top sellers this month',
  sellers: sellers([
    ['Wireless mouse', 'Blue', '112 sold', '₹1,45,600'],
    ['Glass mousepad', '490 × 420 mm', '64 sold', '₹1,15,200'],
    ['Mechanical keyboard', 'Ocean Blue', '71 sold', '₹49,700'],
  ]),
  sources: [
    { label: 'Instagram', percent: 58 },
    { label: 'Google', percent: 24 },
    { label: 'Direct', percent: 13 },
    { label: 'WhatsApp', percent: 5 },
  ],
  todoTitle: 'Worth a look this month',
  todos: [
    {
      icon: '📉',
      text: '12 products did not sell at all in October.',
      linkLabel: 'Review them',
      url: `${admin}/products`,
    },
    {
      icon: '↩️',
      text: 'Refunds were 3.1% of sales, up from 2.4% in September.',
      linkLabel: 'See returns',
      url: `${admin}/orders/returns`,
    },
  ],
  moneyTitle: 'Money this month',
  money: [
    { label: 'Gross sales', amount: '₹6,91,400' },
    { label: 'Discounts', amount: '− ₹28,600' },
    { label: 'Refunds', amount: '− ₹20,000' },
  ],
  footer: 'Sent on the 1st of every month to staff who turned on the monthly report.',
}

export const sampleDailyReport: PerformanceReport = {
  ...sampleWeeklyReport,
  period: 'daily',
  kicker: 'Daily summary · Tuesday',
  title: 'Yesterday at Waimers.',
  periodLabel: 'Tuesday 18 November',
  netLabel: '₹28,400',
  change: up('12%'),
  changeNote: 'vs ₹25,350 last Tuesday',
  bars: [
    ['12–6am', 2],
    ['6–10am', 3],
    ['10am–2pm', 7],
    ['2–6pm', 5],
    ['6–10pm', 9],
    ['10pm–12', 2],
  ].map(([label, k]) => ({
    label: String(label),
    valueLabel: `₹${k}k`,
    value: Number(k),
    best: label === '6–10pm',
  })),
  barNote: 'Most orders came in between 6 and 10 pm.',
  stats: [
    { label: 'Orders', value: '15', change: up('3') },
    { label: 'Visitors', value: '640', change: down('4%') },
    { label: 'Conversion', value: '2.3%', change: up('0.3 pt') },
  ],
  vsLabel: 'vs last Tue',
  historyTitle: 'Your last seven days',
  history: ['Wed ₹22k', 'Thu ₹26k', 'Fri ₹31k', 'Sat ₹42k', 'Sun ₹30k', 'Mon ₹24k', 'Tue ₹28k'].map(
    (s) => {
      const [label = '', value = ''] = s.split(' ')
      return { label, value }
    },
  ),
  button: { label: 'Open orders', url: `${admin}/orders` },
  sellersTitle: 'Sold most yesterday',
  sources: [],
  todoTitle: 'Waiting on you today',
  todos: [
    {
      icon: '📦',
      text: '9 orders are paid and ready to pack.',
      linkLabel: 'Pack orders',
      url: `${admin}/orders`,
    },
    {
      icon: '📞',
      text: '3 cash-on-delivery orders need a confirmation call.',
      linkLabel: 'Confirm COD',
      url: `${admin}/orders`,
    },
  ],
  todosFirst: true,
  moneyTitle: 'Money yesterday',
  money: [
    { label: 'Gross sales', amount: '₹30,100' },
    { label: 'Discounts', amount: '− ₹1,700' },
    { label: 'Refunds', amount: '₹0' },
  ],
  footer: 'Sent every day at the hour you chose to staff who turned on the daily summary.',
}
