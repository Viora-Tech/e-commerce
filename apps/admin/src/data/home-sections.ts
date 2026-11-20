/**
 * Copy for the Home redesign's new sections (Figma "Home · Redesign 19 Nov", 1044:11219):
 * Needs you with its Store health and old-orders rows, How you're doing's dates and "What
 * changed" lines, payment method names, and the slim monthly-goal row. The rest of Home's copy
 * stays in `data/home.ts`.
 */

const days = (n: number) => (n === 1 ? '1 day' : `${n} days`)

export const homeSectionsContent = {
  needsYou: {
    title: 'Needs you',
    /** "4 jobs · oldest waiting 2 days" beside the title. */
    jobs: (n: number) => (n === 1 ? '1 job' : `${n} jobs`),
    oldestWaiting: (n: number) => `oldest waiting ${days(n)}`,
    /** The chip on Ship. */
    oldest: (n: number) => `Oldest ${days(n)}`,
    /** The red chip on Restock. */
    outOfStock: (n: number) => `${n} out of stock`,
  },
  /** Store health's slim row; its title and button come from `data/store-health.ts`. */
  health: {
    toFix: (n: number) => `${n} to fix`,
  },
  oldOrders: {
    lead: (n: number) =>
      n === 1
        ? '1 order is older than 30 days and still says To ship.'
        : `${n} orders are older than 30 days and still say To ship.`,
    body: 'Shipped them outside Koomerce? Mark them so they stop counting.',
    cta: 'Mark as shipped elsewhere',
  },
  doing: {
    /** "Last 30 days (20 Oct – 18 Nov) compared with the 30 days before (20 Sep – 19 Oct)". */
    period: (n: number, from: string, to: string, beforeFrom: string, beforeTo: string) =>
      `Last ${n} days (${from} – ${to}) compared with the ${n} days before (${beforeFrom} – ${beforeTo})`,
    periodNoBefore: (n: number, from: string, to: string) => `Last ${n} days (${from} – ${to})`,
    whatChanged: 'What changed',
    /* Each line: a bold lead, then the rest; every line says the period it covers. */
    salesLead: (n: number, amount: string) => `Sales in the last ${n} days: ${amount},`,
    salesUp: (pct: string, before: string, n: number) =>
      `up ${pct} from ${before} in the ${n} days before.`,
    salesDown: (pct: string, before: string, n: number) =>
      `down ${pct} from ${before} in the ${n} days before.`,
    salesFlat: (before: string, n: number) =>
      `about the same as ${before} in the ${n} days before.`,
    salesNoBefore: 'with nothing to compare it with yet.',
    bestLead: (n: number) => `Best seller by sales, last ${n} days:`,
    best: (title: string, amount: string) => `${title}, ${amount}.`,
    mostUnits: (title: string, units: number) => `Most units sold: ${title}, ${units}.`,
    lowStockLead: (n: number) => (n === 1 ? '1 product' : `${n} products`),
    lowStock: (n: number) =>
      n === 1 ? 'is running low on stock right now.' : 'are running low on stock right now.',
    streakLead: 'A sale every day',
    streak: (n: number) => `for the last ${n} days.`,
    noData: 'This shows what changed once you have a few days of orders.',
  },
  /** How an order was paid (API `PaymentMixMethod`), as the payment bars name it. */
  paymentMethods: {
    upi: 'UPI',
    card: 'Card',
    netbanking: 'Netbanking',
    wallet: 'Wallet',
    emi: 'EMI',
    pay_later: 'Pay later',
    cod: 'Cash on delivery',
    store_credit: 'Store credit',
    gift_card: 'Gift card',
    online: 'Online payment',
    other: 'Other',
  },
  goal: {
    noGoal: 'No goal set.',
    suggested: (lastMonth: string, target: string) =>
      `No goal set. Last month you sold ${lastMonth}, so ${target} would be a good target.`,
  },
} as const
