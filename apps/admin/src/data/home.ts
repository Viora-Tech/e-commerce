/** Copy for the admin home. Plain words for a shop owner who is not technical. */

/** "Good morning" / "Good afternoon" / "Good evening", by the hour in the store's clock (IST). */
export function greetingWord(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** The plain-language line under the greeting: "3 orders today worth ₹43,699, 2 need shipping." */
export function summaryLine(input: {
  ordersToday: number
  salesToday: string
  toShip: number
}): string {
  const { ordersToday, salesToday, toShip } = input
  if (ordersToday === 0) return 'No orders yet today.'
  const orderWord = ordersToday === 1 ? 'order' : 'orders'
  const base = `${ordersToday} ${orderWord} today worth ${salesToday}`
  if (toShip === 0) return `${base}.`
  const shipWord = toShip === 1 ? 'needs' : 'need'
  return `${base}, ${toShip} ${shipWord} shipping.`
}

/** "Good evening, Waimers", or just the greeting when the member has no first name. */
export function greetingTitle(greeting: string, firstName: string): string {
  return firstName ? `${greeting}, ${firstName}` : greeting
}

/** The Home page's own layout copy: set-up cards, to do, sales hero, orders, live, suggestions. */
export const homePageContent = {
  ask: {
    placeholder: 'Ask anything about your store…',
    button: 'Ask',
    label: 'Ask the AI assistant',
  },
  setup: {
    title: 'Finish setting up',
    progress: (done: number, total: number) => `${done} of ${total} done`,
    products: {
      title: 'Add your products',
      done: (n: number) => (n === 1 ? '1 product in your store' : `${n} products in your store`),
      todo: 'Add your first product to start selling',
    },
    payments: {
      title: 'Connect payments',
      done: (name: string) => `${name} is receiving payments`,
      todo: 'Connect a gateway to accept UPI and cards',
    },
    shipping: {
      title: 'Set up shipping',
      done: (name: string) => `${name} is connected`,
      todo: 'Connect a courier to print labels',
    },
  },
  todo: {
    title: 'To do',
    count: (n: number) => `${n} need you`,
  },
  sales: {
    title: 'Sales today',
    titleDays: (n: number) => `Sales, last ${n} days`,
    today: 'Today',
    days7: '7 days',
    days30: '30 days',
    vsYesterday: 'vs yesterday',
    vsPrevious: (n: number) => `vs the ${n} days before`,
    orders: (n: number) => (n === 1 ? '1 order' : `${n} orders`),
    hourlyNote: 'Orders by hour, today against yesterday',
    empty: 'A sales chart will appear here once you have paid orders.',
    series: { today: 'Today', yesterday: 'Yesterday', sales: 'Sales', before: 'Before' },
  },
  latest: {
    title: 'Latest orders',
    viewAll: 'View all',
    empty: 'New orders will show up here the moment they come in.',
    toShip: 'To ship',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    paymentDue: 'Payment due',
    refund: 'Refund due',
    done: 'Paid',
  },
  live: {
    title: 'Live now',
    visitors: (n: number) => (n === 1 ? 'visitor on your store' : 'visitors on your store'),
    today: (orders: string, sales: string) => `${orders} today · ${sales}`,
    ordersWord: (n: number) => (n === 1 ? '1 order' : `${n} orders`),
  },
  suggest: {
    title: 'Suggested for you',
    note: 'Based on your store',
    dismiss: 'Hide this suggestion',
    restockTitle: 'Restock your best seller',
    restockBody: (title: string, units: number, left: number) =>
      `${title} sold ${units} this week and only ${left} ${left === 1 ? 'is' : 'are'} left.`,
    restockCta: 'Restock',
    abandonedTitle: 'Recover abandoned carts',
    abandonedBody: (carts: number, value: string) =>
      `${carts} ${carts === 1 ? 'cart' : 'carts'} worth ${value} were left behind this week. Send a gentle reminder.`,
    abandonedCta: 'Open',
    reviewsTitle: 'Collect product reviews',
    reviewsBody: 'Install the Reviews app so shoppers can rate what they bought.',
    reviewsCta: 'Open',
    describeTitle: 'Write product descriptions',
    describeBody: 'Draft them with AI in English and Hindi; you approve each one.',
    describeCta: 'Open',
    saleTitle: 'Plan a sale',
    saleBody: 'Create a discount for your next sale in one step, ready in minutes.',
    saleCta: 'Open',
    whatsappTitle: 'Send order updates on WhatsApp',
    whatsappBody: 'Connect WhatsApp so shoppers hear about their order without calling you.',
    whatsappCta: 'Connect',
  },
  more: {
    title: 'More numbers',
    subtitle: 'Sales over time, products, payments and when people buy',
  },
}

export const homeContent = {
  /** Stands in for the member's first name in the briefing when their account has none. */
  briefing: {
    fallbackName: 'there',
  },
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
        label: (n: number) => (n === 1 ? 'Ship 1 order' : `Ship ${n} orders`),
        help: 'Paid, packed and waiting on a courier.',
        cta: 'Ship orders',
      },
      upiToVerify: {
        label: (n: number) => (n === 1 ? 'Check 1 UPI payment' : `Check ${n} UPI payments`),
        help: 'Match the transfer, then mark it paid.',
        cta: 'Check payments',
      },
      gstQueued: {
        label: (n: number) => (n === 1 ? 'Issue 1 GST invoice' : `Issue ${n} GST invoices`),
        help: 'Waiting for you to issue them.',
        cta: 'Issue invoices',
      },
      lowStock: {
        label: (n: number) => (n === 1 ? 'Restock 1 product' : `Restock ${n} products`),
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
    credit: 'Globe: cobe (MIT). Made with Natural Earth',
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
    progressOf: (done: string, goal: string) => `${done} of ${goal}`,
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
    /** "12 am" … "11 pm": the heatmap's hour names (IST). */
    hourLabel: (h: number) => {
      if (h === 0) return '12 am'
      if (h < 12) return `${h} am`
      if (h === 12) return '12 pm'
      return `${h - 12} pm`
    },
    heatmapCell: (day: string, hour: string, count: number) => `${day}, ${hour}: ${count} orders`,
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    todayVsYesterday: 'Today vs yesterday',
  },
} as const
