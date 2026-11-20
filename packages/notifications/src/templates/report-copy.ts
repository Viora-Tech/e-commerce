/**
 * Every word the team performance reports carry (daily summary, weekly and monthly report), for
 * `@commerce/core` to fill a `PerformanceReport` with. Like all email copy, English only; the
 * admin's names for these messages have their Hindi overlay in `apps/admin/src/data/hi/`.
 */
type Kind = 'daily' | 'weekly' | 'monthly'

/** "orders" against "order", for the to-do lines. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const reportCopy = {
  kicker: {
    daily: (weekday: string) => `Daily summary · ${weekday}`,
    weekly: (week: number) => `Weekly report · Week ${week}`,
    monthly: (month: string) => `Monthly report · ${month}`,
  },
  title: {
    daily: (store: string, today: boolean) =>
      today ? `Today so far at ${store}.` : `Yesterday at ${store}.`,
    weekly: (store: string) => `Your week at ${store}.`,
    monthly: (store: string, month: string) => `Your ${month} at ${store}.`,
  },
  /** After the change pill: "vs ₹1,56,220 last week". */
  changeNote: {
    daily: (amount: string, weekday: string) => `vs ${amount} last ${weekday}`,
    weekly: (amount: string) => `vs ${amount} last week`,
    monthly: (amount: string, month: string) => `vs ${amount} in ${month}`,
  },
  /** After each figure's change. */
  vsLabel: {
    daily: (weekdayShort: string) => `vs last ${weekdayShort}`,
    weekly: () => 'vs last week',
    monthly: (month: string) => `vs ${month}`,
  },
  /** Under the bars, naming the best one. */
  barNote: {
    daily: (from: string, to: string) => `Most orders came in between ${from} and ${to}.`,
    weekly: (day: string, orders: number, amount: string) =>
      `${day} was your best day: ${plural(orders, 'order', 'orders')} worth ${amount}.`,
    monthly: (week: string, amount: string, orders: number) =>
      `${week} was your best week: ${amount} from ${plural(orders, 'order', 'orders')}.`,
  },
  /** The last history column. */
  historyNow: { daily: null, weekly: 'This week', monthly: null } satisfies Record<
    Kind,
    string | null
  >,
  historyTitle: {
    daily: 'Your last seven days',
    weekly: 'Your last five weeks',
    monthly: 'Your last six months',
  } satisfies Record<Kind, string>,
  sellersTitle: {
    daily: 'Sold most',
    weekly: 'Your top sellers',
    monthly: 'Your top sellers this month',
  } satisfies Record<Kind, string>,
  todoTitle: {
    daily: 'Waiting on you today',
    weekly: 'Worth a look this week',
    monthly: 'Worth a look this month',
  } satisfies Record<Kind, string>,
  moneyTitle: {
    daily: 'Money for the day',
    weekly: 'Money this week',
    monthly: 'Money this month',
  } satisfies Record<Kind, string>,
  footer: {
    daily: 'Sent every day at the hour you chose to staff who turned on the daily summary.',
    weekly: 'Sent every Monday at 9:00 to staff who turned on the weekly report.',
    monthly: 'Sent on the 1st of every month at 9:00 to staff who turned on the monthly report.',
  } satisfies Record<Kind, string>,
  stats: {
    orders: 'Orders',
    visitors: 'Visitors',
    conversion: 'Conversion',
    averageOrder: 'Average order',
    newCustomers: 'New customers',
    repeatBuyers: 'Repeat buyers',
  },
  /** A rate's change in percentage points: "0.4 pt". */
  points: (n: string) => `${n} pt`,
  sold: (units: number) => `${units} sold`,
  button: {
    daily: 'Open orders',
    weekly: 'Open your analytics',
    monthly: 'Open your analytics',
  } satisfies Record<Kind, string>,
  money: { gross: 'Gross sales', discounts: 'Discounts', refunds: 'Refunds' },
  /** Where buyers came from, by attribution channel. */
  sources: {
    direct: 'Direct',
    organic_search: 'Search',
    paid_search: 'Search ads',
    social: 'Social',
    paid_social: 'Social ads',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    ai_assistant: 'AI assistants',
    referral: 'Other sites',
    affiliate: 'Affiliates',
    other_paid: 'Other ads',
  } as Record<string, string>,
  otherSource: 'Other',
  todos: {
    toShip: (n: number) => ({
      icon: '📦',
      text: `${plural(n, 'order is', 'orders are')} paid and ready to pack.`,
      linkLabel: 'Pack orders',
    }),
    abandoned: (n: number, amount: string) => ({
      icon: '🛒',
      text: `${plural(n, 'cart was', 'carts were')} left at checkout, worth ${amount}.`,
      linkLabel: 'Send a reminder',
    }),
    refunds: (now: string, before: string, month: string) => ({
      icon: '↩️',
      text: `Refunds were ${now} of sales, up from ${before} in ${month}.`,
      linkLabel: 'See returns',
    }),
  },
}
