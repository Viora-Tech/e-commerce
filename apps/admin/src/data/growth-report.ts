/** Copy for Growth's reports: recommendations, the buyer split, campaign funnels and link QR codes. */

export const growthRecommendationsContent = {
  title: 'Recommendations',
  subtitle: "Next steps picked from your store's own numbers.",
  empty: 'Nothing to suggest right now. New ideas show up here as your numbers change.',
  dismiss: 'Dismiss',
  dismissed: 'Recommendation dismissed',
  created: 'Automation created. Check the message, then turn it on.',
  actions: {
    create: 'Set it up',
    open: 'Open automation',
    campaign: 'Create campaign',
    links: 'View links',
  },
  cards: {
    abandoned_checkout: {
      title: 'Recover abandoned checkouts',
      reason: (carts: string, value: string) =>
        `${carts} checkouts worth ${value} were left in the last 7 days, and no reminder goes out.`,
    },
    cod_confirmation: {
      title: 'Confirm cash on delivery orders on WhatsApp',
      reason: (cod: string, total: string, share: string) =>
        `${cod} of your ${total} orders in the last 30 days (${share}) were cash on delivery. A quick confirmation cuts returns.`,
    },
    win_back: {
      title: 'Win back lapsed customers',
      reason: (customers: string) =>
        `${customers} subscribed customers have not ordered in 90 days.`,
    },
    welcome: {
      title: 'Welcome new subscribers',
      reason: (last30: string, previous30: string) =>
        `${last30} people subscribed in the last 30 days (${previous30} in the 30 days before), and nothing welcomes them.`,
    },
    campaign: {
      title: 'Send a campaign',
      reason: (subscribers: string, days: string | null) =>
        days === null
          ? `You have ${subscribers} subscribers and have not sent a campaign yet.`
          : `Your last campaign went out ${days} days ago. ${subscribers} subscribers have not heard from you since.`,
    },
    links_no_orders: {
      title: 'A link gets clicks but no orders',
      reason: (name: string, clicks: string) =>
        `“${name}” got ${clicks} clicks in the last 30 days and no orders yet. Check the page it opens.`,
    },
  },
} as const

export const growthSplitContent = {
  newBuyers: 'First-time',
  returning: 'Returning',
  orders: (n: string) => `${n} orders`,
  filter: {
    label: 'Channels',
    all: 'All',
    paid: 'Paid',
    organic: 'Organic',
    empty: 'No channels of this kind in this range.',
  },
} as const

export const campaignPerformanceContent = {
  trend: {
    title: 'Results over time',
    subtitle: 'Sessions, orders and sales from this campaign, day by day since sending began.',
    metrics: { sessions: 'Sessions', orders: 'Orders', sales: 'Sales' },
    empty: 'No visits or orders from this campaign yet',
  },
  funnel: {
    title: 'Funnel',
    subtitle: 'From the send to the orders it brought.',
    steps: {
      sent: 'Sent',
      delivered: 'Delivered',
      opened: 'Opened',
      visited: 'Visited the store',
      carted: 'Added to cart',
      ordered: 'Ordered',
    },
    ofPrevious: (pct: string) => `${pct} of the step before`,
    omitted: {
      opened: 'WhatsApp does not report opens, so that step is left out.',
      carted: 'Carts are not tracked for this campaign, so that step is left out.',
    } as Record<string, string>,
    help: 'Delivered means the provider accepted the message. Visits are store sessions that began on one of its links.',
  },
  rates: {
    title: 'Delivery and engagement',
    delivery: 'Delivery rate',
    bounce: 'Bounce rate',
    unsubscribe: 'Unsubscribe rate',
    complaint: 'Spam complaints',
    open: 'Open rate (estimate)',
    of: (part: string, whole: string) => `${part} of ${whole}`,
    notReported: 'Not reported by this channel',
    openNote:
      'Apple Mail and some other apps open every email on delivery, so treat opens as an estimate.',
    unsubscribeNote: (days: number) => `Recipients who unsubscribed within ${days} days.`,
  },
  links: {
    title: 'Links',
    subtitle:
      'Emails do not record which link was pressed, so visits are grouped by the page each link opened.',
    columns: { link: 'Page', visits: 'Visits', orders: 'Orders', sales: 'Sales' },
    empty: 'No visits from this campaign yet.',
  },
  split: {
    title: 'First-time vs returning',
    newBuyers: 'First-time buyers',
    returning: 'Returning buyers',
    orders: (n: string) => `${n} orders`,
    empty: 'No orders from this campaign yet.',
  },
} as const

export const linkQrContent = {
  menu: 'QR code',
  title: (name: string) => `QR code for ${name}`,
  body: 'Print it on packaging, flyers or your counter. Every scan counts as a click on this link.',
  png: 'Download PNG',
  svg: 'Download SVG',
  close: 'Close',
  failed: 'The QR code could not be made.',
  alt: (url: string) => `QR code that opens ${url}`,
} as const
