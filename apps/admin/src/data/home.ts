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
    shortcut: '⌘K',
  },
  setup: {
    title: 'Finish setting up',
    progress: (done: number, total: number) => `${done} of ${total} done`,
    openCta: 'Set up',
    products: {
      title: 'Add your products',
      done: (n: number) => (n === 1 ? '1 product in your store' : `${n} products in your store`),
      todo: 'Add your first product to start selling',
    },
    payments: {
      title: 'Connect payments',
      done: (name: string) => `${name} is receiving payments`,
      testMode: (name: string) =>
        `${name} is in test mode. Switch to live keys to take real payments`,
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
    edit: 'Edit to-dos',
    editTitle: 'Edit to-dos',
    editBody:
      'Pick which to-dos show on Home. A ticked one shows only when there is something to do.',
    names: {
      ship: 'Orders to ship',
      unpaid: 'Payments to collect',
      upi: 'UPI payments to check',
      balance: 'Pre-order balances due',
      preorderShip: 'Pre-orders shipping this week',
      returns: 'Returns to review',
      gst: 'GST invoices to issue',
      stock: 'Products to restock',
    },
    cancel: 'Cancel',
    save: 'Save',
    saved: 'To-dos updated',
    saveFailed: 'Could not save your to-dos. Try again.',
  },
  sales: {
    title: 'Sales today',
    titleDays: (n: number) => `Sales, last ${n} days`,
    today: 'Today',
    days7: '7 days',
    days30: '30 days',
    channels: 'All channels',
    liveNow: (n: number) => `${n} live now`,
    customize: 'Customize',
    totalSales: 'Total sales',
    ordersTitle: 'Orders',
    visitorsTitle: 'Visitors',
    conversionTitle: 'Conversion rate',
    points: 'pts',
    visitorsNow: 'live now',
    viewReport: 'View sales report',
    vsYesterday: 'vs yesterday',
    noCompare: 'No comparison',
    emptyVisitors: 'Sessions will show here once shoppers start visiting your store.',
    /** The range picker (Figma 580:692 "Today ▾"). */
    ranges: {
      today: 'Today',
      yesterday: 'Yesterday',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      thisMonth: 'This month',
      lastMonth: 'Last month',
      thisQuarter: 'This quarter',
      thisFy: 'This financial year',
      diwali: 'Diwali week',
      festive: 'Festive season',
      custom: 'Custom range',
    },
    festiveHint: 'Sep–Nov',
    rangeLabel: 'Date range',
    from: 'From',
    to: 'To',
    compareTo: 'Compare to',
    compareOptions: { previous: 'Previous period', year: 'Same dates last year' },
    vsPeriod: 'vs previous period',
    vsYear: 'vs last year',
    cancel: 'Cancel',
    apply: 'Apply',
    /** The channels menu; only the online store sells today. */
    channelOptions: {
      all: 'All channels',
      online: 'Online store',
      instagram: 'Instagram',
      whatsapp: 'WhatsApp',
      google: 'Google & YouTube',
      pos: 'In-store (POS)',
      other: 'Other',
    },
    soon: 'Soon',
    /** Customize: which metric sits in each tile. */
    metrics: {
      sales: 'Total sales',
      orders: 'Orders',
      aov: 'Average order value',
      sessions: 'Sessions',
      visitors: 'Visitors',
      conversion: 'Conversion rate',
      returning: 'Returning customers',
      gross: 'Gross sales',
      refunds: 'Refunds',
      discounts: 'Discounts given',
      gst: 'GST collected',
      codShare: 'COD vs prepaid',
      abandoned: 'Abandoned carts',
      shipping: 'Shipping charged',
      topProducts: 'Top products',
    },
    pickMetric: 'Choose a metric for this slot',
    searchMetrics: 'Search metrics',
    noMetric: 'No metric matches',
    done: 'Done',
    customizeHint: 'Pick a tile to change what it shows',
    bestSeller: (title: string) => `Best: ${title}`,
    loadFailed: 'Could not load these numbers. Try again.',
    tilesSaveFailed: 'Could not save your tiles',
    compareLabel: 'Compare with',
    noHourly: 'Visitors are counted by the day. Pick 7 or 30 days to see this chart.',
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
    ship: 'Ship',
    view: 'View',
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
    hidden: 'Suggestion hidden',
    undo: 'Undo',
    reviewsTitle: 'Collect product reviews',
    reviewsBody: 'Install the Reviews app so shoppers can rate what they bought.',
    reviewsCta: 'Open',
    /* Smart cards (#101): built daily from the store's own numbers (`@commerce/core` home-cards). */
    weakPageTitle: (title: string) => `${title}: the page is not selling`,
    weakPageBody: (sessions: number, carts: number) =>
      `${sessions} sessions and ${carts} ${carts === 1 ? 'add to cart' : 'adds to cart'} in 30 days. Better photos and a video usually help.`,
    weakPageCta: 'Improve its media',
    staleTitle: (title: string) => `${title} is still live`,
    staleSeasonBody: 'Its season is over. Unpublish it so shoppers do not land on an old offer.',
    staleYearBody: 'Its name still has an old year in it. Unpublish or rename it.',
    staleCta: 'Unpublish',
    repeatTitle: (n: number) => `${n} repeat buyers`,
    repeatBody:
      'Customers with 2 or more orders. Make a segment to thank them or give them early access.',
    repeatCta: 'Make a segment',
    repeatSegmentName: 'Repeat buyers',
    restockTitle: (title: string) => `Restock ${title}`,
    restockBody: (units: number, left: number, days: number) =>
      `Sold ${units} in 30 days and ${left} left: about ${days} ${days === 1 ? 'day' : 'days'} at this pace.`,
    restockCta: 'Restock',
    unfulfilledTitle: (n: number) => `${n} ${n === 1 ? 'order' : 'orders'} waiting to ship`,
    unfulfilledBody: (days: number) =>
      `The oldest has waited ${days} days. Late parcels bring cancellations and bad reviews.`,
    unfulfilledCta: 'Ship them',
    abandonedTitle: 'Recover abandoned checkouts',
    abandonedBody: (carts: number, value: string) =>
      `${carts} ${carts === 1 ? 'checkout' : 'checkouts'} worth ${value} were left this week. Send a gentle reminder.`,
    abandonedCta: 'Open',
    trendingTitle: (title: string, percent: number) => `${title} sales up ${percent}%`,
    trendingBody: (revenue: string) =>
      `${revenue} in the last 30 days, against the 30 before. Keep it in stock and in front of shoppers.`,
    trendingCta: 'Ask AI what to do',
    trendingPrompt: (title: string, percent: number) =>
      `${title} sales are up ${percent}% on last month. Suggest what I should do next (stock, a collection, a discount or its price) and propose the changes.`,
    whatsappTitle: 'Send order updates on WhatsApp',
    whatsappBody: 'Connect WhatsApp so shoppers hear about their order without calling you.',
    whatsappCta: 'Connect',
  },
  more: {
    title: 'More numbers',
    subtitle: 'Sales over time, products and payments',
    previewSales: 'Sales',
    previewProducts: 'Top products',
    previewPayments: 'Payments',
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
        waiting: (days: number) => (days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`),
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
      unpaid: {
        label: (n: number) =>
          n === 1 ? 'Collect payment for 1 order' : `Collect payment for ${n} orders`,
        help: 'Open orders that are not paid yet, cash on delivery included.',
        cta: 'View unpaid',
      },
      preorderShipSoon: {
        label: (n: number) =>
          n === 1
            ? '1 pre-order campaign ships this week'
            : `${n} pre-order campaigns ship this week`,
        help: 'Get the stock in and ready to send.',
        cta: 'View campaigns',
      },
      returnsToReview: {
        label: (n: number) => (n === 1 ? 'Review 1 return' : `Review ${n} returns`),
        help: 'Customers asked to return; approve or reject.',
        cta: 'Review returns',
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
      `Your best seller in the last 30 days is ${title}, with ${units} sold.`,
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
