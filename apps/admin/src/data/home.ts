/** Copy for the admin home. Plain words for a shop owner who is not technical. */

/** "Good morning" / "Good afternoon" / "Good evening", by the hour in the store's clock (IST). */
export function greetingWord(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** The one-line briefing at the top: "Good evening, Kuldeep. 14 orders today worth ₹23,400, 3 need shipping." */
export function briefingSentence(input: {
  greeting: string
  firstName: string
  ordersToday: number
  salesToday: string
  toShip: number
}): string {
  const { greeting, firstName, ordersToday, salesToday, toShip } = input
  if (ordersToday === 0) {
    return `${greeting}, ${firstName}. No orders yet today.`
  }
  const orderWord = ordersToday === 1 ? 'order' : 'orders'
  const base = `${greeting}, ${firstName}. ${ordersToday} ${orderWord} today worth ${salesToday}`
  if (toShip === 0) return `${base}.`
  const shipWord = toShip === 1 ? 'needs' : 'need'
  return `${base}, ${toShip} ${shipWord} shipping.`
}

export const homeContent = {
  /** Shared with `data/status.ts`'s generic stock badge (used outside the home page too). */
  bestSelling: {
    inStock: 'Stock',
    outOfStock: 'Stock out',
  },
  needsYou: {
    title: 'Needs you',
    subtitle: 'The things only you can do next',
    allClearHeading: "You're all caught up",
    allClearBody: 'Nothing needs your attention right now. Nice work.',
    rows: {
      ordersToShip: {
        label: (n: number) =>
          n === 1 ? '1 order is ready to ship' : `${n} orders are ready to ship`,
        help: 'Paid, packed and waiting on a courier.',
        cta: 'Ship orders',
      },
      upiToVerify: {
        label: (n: number) =>
          n === 1 ? '1 UPI payment needs checking' : `${n} UPI payments need checking`,
        help: 'Match the transfer to the order, then mark it paid.',
        cta: 'Check payments',
      },
      gstQueued: {
        label: (n: number) =>
          n === 1 ? '1 GST invoice is queued' : `${n} GST invoices are queued`,
        help: 'Waiting for you to issue them.',
        cta: 'Issue invoices',
      },
      lowStock: {
        label: (n: number) =>
          n === 1 ? '1 product is running low' : `${n} products are running low`,
        help: 'Running out soon at the current pace.',
        cta: 'Restock',
      },
      preorderBalanceDue: {
        label: (n: number) =>
          n === 1
            ? '1 pre-order is waiting on its balance'
            : `${n} pre-orders are waiting on their balance`,
        help: 'The deposit is in; the rest is not.',
        cta: 'View pre-orders',
      },
      failedDeliveries: {
        label: (n: number) => (n === 1 ? '1 delivery failed' : `${n} deliveries failed`),
        help: 'The courier could not deliver and needs a decision.',
        cta: 'View deliveries',
        comingSoon: 'Turns on once a courier reports failed deliveries.',
      },
    },
  },
  insights: {
    title: 'What is happening',
    salesUp: (pct: string, comparedTo: string) => `Sales are up ${pct} vs ${comparedTo}.`,
    salesDown: (pct: string, comparedTo: string) => `Sales are down ${pct} vs ${comparedTo}.`,
    salesFlat: 'Sales are about the same as last week.',
    comparedToLastWeek: 'the same period last week',
    bestSeller: (title: string, units: number) =>
      `Your best seller this week is ${title}, with ${units} sold.`,
    lowStockNudge: (n: number) =>
      n === 1
        ? '1 product will run out soon at this pace.'
        : `${n} products will run out soon at this pace.`,
    streak: (n: number) =>
      n <= 1 ? 'Today is your streak day one.' : `You have sold something ${n} days in a row.`,
    noData: 'Insights show up here once you have a week of orders.',
  },
  liveGlobe: {
    title: 'Live view',
    subtitle: 'Orders as they come in, worldwide',
    empty: 'Orders will appear here on the globe once you have shipping addresses.',
    ordersToday: 'Orders today',
    salesToday: 'Sales today',
    visitorsNow: 'Visitors now',
    tooltipOrder: (number: number) => `Order #${number}`,
    unsupported: 'Your browser cannot draw the 3-D globe, so here is the order list instead.',
    credit: 'Globe: cobe (MIT)',
  },
  liveStream: {
    title: 'Latest orders',
    empty: 'New orders will show up here the moment they come in.',
    viewAll: 'View all orders',
  },
  goal: {
    title: 'Monthly sales goal',
    edit: 'Edit goal',
    save: 'Save goal',
    cancel: 'Cancel',
    setGoal: 'Set a goal',
    inputLabel: 'This month’s sales goal',
    inputHelp: 'Kept on this device for now.',
    inputError: 'Enter an amount between ₹1 and ₹1,00,00,000.',
    percentDone: (pct: number) => `${pct}% of the way there`,
    daysLeft: (n: number) => (n === 1 ? '1 day left' : `${n} days left`),
    projected: (amount: string) => `On this pace, you will finish around ${amount}.`,
    noGoal: 'Set a goal to track this month against it.',
    noGoalSuggested: (amount: string) =>
      `Set a goal to track this month against it. Last month you sold ${amount} — that could be a good target.`,
    record: (amount: string, when: string) => `Best day so far: ${amount} on ${when}.`,
    noRecord: 'Your best day will show up here once you have sales to compare.',
  },
  charts: {
    sectionTitle: "How you're doing",
    sectionSubtitle: 'A closer look at sales, products and payments',
    range7: '7 days',
    range30: '30 days',
    range90: '90 days',
    salesTitle: 'Sales over time',
    salesLine: (pct: string, up: boolean) =>
      up
        ? `Sales are up ${pct} compared with the period before.`
        : `Sales are down ${pct} compared with the period before.`,
    salesFlat: 'Sales are about the same as the period before.',
    salesNoPrevious: 'Not enough history yet to compare with the period before.',
    salesEmpty: 'A sales line will appear here once you have paid orders.',
    ordersToggle: 'Orders',
    salesToggle: 'Sales',
    previous: 'Previous period',
    topProductsTitle: 'Top products',
    topProductsLine: (title: string) => `${title} is your top earner in this range.`,
    topProductsEmpty: 'Your best sellers for this range will show up here.',
    stateTitle: 'Sales by state',
    stateLine: (name: string, pct: string) =>
      `${pct} of the last 30 days' sales came from ${name}.`,
    stateEmpty: 'A state breakdown will show up here once orders have shipping addresses.',
    paymentTitle: 'How customers pay',
    paymentLine: (label: string, pct: string) => `${pct} of orders paid by ${label}.`,
    paymentEmpty: 'A payment breakdown will show up here once you have orders.',
    statusTitle: 'Orders by status',
    statusLine: (label: string, pct: string) => `${pct} of the last 30 days' orders are ${label}.`,
    statusEmpty: 'A status breakdown will show up here once you have orders.',
    statusLabels: {
      to_ship: 'to ship',
      shipped: 'shipped',
      delivered: 'delivered',
      cancelled: 'cancelled',
    },
    heatmapTitle: 'When people buy',
    heatmapLine: (day: string, from: string, to: string) =>
      `Most orders come in on ${day}s, between ${from} and ${to}.`,
    heatmapEmpty: 'A pattern will show up here once you have a few weeks of orders.',
    heatmapLegendLow: 'Fewer',
    heatmapLegendHigh: 'More',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    todayVsYesterday: 'Today vs yesterday',
  },
} as const
