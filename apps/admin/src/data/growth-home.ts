import { siteConfig } from '@commerce/config/site'

/** Copy for Growth laid out like Shopify's: the overview, Attribution, Autopilot and the Campaigns tabs. */

/** The merchant guide's Autopilot page ("Learn more"). */
export const AUTOPILOT_DOCS_URL = `${siteConfig.urls.docs}/merchant-guide/growth/autopilot`

export const growthHomeContent = {
  title: 'Growth',
  /** The page header's line (audit #52). */
  summary: 'How marketing brings visits and sales, and what to try next.',
  hero: {
    title: 'Campaign Autopilot',
    body: 'Campaign Autopilot plans campaigns for your store on email, from cart reminders to festive sales, and keeps refining the plan while you stay in control.',
    on: 'Autopilot is on. Proposed campaigns wait for your approval.',
    waiting: (n: number) =>
      `${n} ${n === 1 ? 'campaign is' : 'campaigns are'} waiting for your approval.`,
    getStarted: 'Get started',
    review: 'Review proposals',
    learnMore: 'Learn more',
    illustration: 'Sales by channel',
  },
  performance: {
    title: 'Performance',
    viewDetails: 'View details',
    /** The charts live on Attribution only (audit #152). */
    more: 'Sales over time, channels and traffic types are on Attribution.',
    open: 'Open Attribution',
  },
  attributed: {
    label: 'Sales attributed to marketing',
    help: 'Orders whose last non-direct visit in the 30 days before buying came from a channel, link or campaign. Dotted: the period before.',
    ofTotal: (total: string) => `of ${total} total store sales`,
    current: 'This period',
    previous: 'Previous period',
    empty: 'No marketing sales yet in this period',
    daily: 'Daily',
    weekly: 'Weekly',
  },
  sessions: {
    label: 'Sessions over time',
    help: 'Visits to your store, day by day, from every source. Dotted: the period before.',
    current: 'This period',
    previous: 'Previous period',
    empty: 'No sessions yet in this period',
  },
  channels: {
    label: 'Top channels',
    help: 'The channels that brought the most sales or sessions in this period.',
    metrics: { sales: 'Sales', sessions: 'Sessions' },
    empty: 'No channel activity yet in this period',
  },
  traffic: {
    label: 'Sessions by traffic type',
    help: 'Direct: typed in or bookmarked. Paid: ads (paid search, paid social). Organic: search, social, email, WhatsApp, AI assistants and referrals. Unknown: visits we could not place.',
    types: { direct: 'Direct', paid: 'Paid', organic: 'Organic', unknown: 'Unknown' },
    empty: 'No sessions yet in this period',
  },
  sources: {
    sessions: (n: string) => `${n} sessions`,
    orderValue: (orders: string, rate: string) =>
      `Order value for ${orders} at ${rate} conversion rate.`,
    orders: (n: number, formatted: string) => `${formatted} ${n === 1 ? 'order' : 'orders'}`,
    help: 'Sessions, and the value of orders whose last non-direct visit came from this source.',
    empty: 'Your top sources show up here once shoppers start arriving.',
  },
  autopilotStrip: {
    title: 'Campaign Autopilot',
    off: 'Turn on Autopilot to plan campaigns for cart recovery, new products, win-back and festive sales.',
    on: (n: number) =>
      n === 0
        ? 'Autopilot is on. Nothing is waiting for approval right now.'
        : `Autopilot is on. ${n} proposed ${n === 1 ? 'campaign is' : 'campaigns are'} waiting for you.`,
    getStarted: 'Get started',
    open: 'Open Autopilot',
  },
  recent: {
    title: 'Recent campaigns',
    viewAll: 'View all',
    automations: 'Marketing automations',
    columns: {
      campaign: 'Campaign',
      updated: 'Updated',
      created: 'Created',
      sessions: 'Sessions (YTD)',
      sales: 'Sales (YTD)',
    },
    help: {
      sessions: 'Visits since 1 January that carried this campaign (its link, button or tag).',
      sales: 'Orders since 1 January credited to this campaign.',
    },
    empty: 'No campaigns yet. Create one, or tag a tracking link with a campaign name.',
    create: 'Create campaign',
  },
} as const

export const growthAttributionContent = {
  title: 'Attribution',
  summary: 'Where your sessions and sales come from, by source, channel and campaign.',
  back: 'Growth',
  compare: 'Compared with the previous period of the same length',
  model: {
    title: 'How sales are credited',
    body: 'Last non-direct click: an order is credited to the last channel, link or campaign the shopper came from in the 30 days before buying. A later direct visit does not take the credit away. Orders with no tracked visit (imports, drafts, API) count as not tracked.',
    window: '30-day window',
    rule: 'Last non-direct click',
  },
  funnel: {
    title: 'From visit to order',
    body: 'How many visitors added to cart, reached checkout and ordered in this period.',
    visits: 'Visits',
    addedToCart: 'Added to cart',
    reachedCheckout: 'Reached checkout',
    ordered: 'Ordered',
    ofPrevious: (pct: string) => `${pct} of the step before`,
    empty: 'No visits tracked in this period yet.',
  },
} as const

export const growthCampaignTabsContent = {
  title: 'Campaigns',
  tabs: { campaigns: 'Campaigns', links: 'Tracking links' },
  automations: 'Marketing automations',
  columns: { sessions: 'Sessions (YTD)', sales: 'Sales (YTD)' },
  tracked: {
    title: 'Campaigns from tracking links',
    subtitle:
      'Visits and orders tagged with a campaign name (utm_campaign) on your links and ads, since 1 January.',
    columns: {
      campaign: 'Campaign',
      links: 'Links',
      sessions: 'Sessions',
      orders: 'Orders',
      sales: 'Sales',
      updated: 'Last activity',
    },
  },
} as const

export const growthAutopilotContent = {
  title: 'Autopilot',
  summary: 'Plans email campaigns from your store’s numbers. Nothing is sent until you approve it.',
  back: 'Growth',
  status: {
    on: 'On',
    off: 'Off',
    toggle: 'Autopilot',
    turnedOn: 'Autopilot is on',
    turnedOff: 'Autopilot is off',
  },
  settings: {
    title: 'Goals and limits',
    subtitle: 'What Autopilot works towards, and the most it may plan in any seven days.',
    goalsLabel: 'Goals',
    goals: {
      recover_carts: {
        label: 'Recover carts',
        body: 'Switch on abandoned-checkout reminders when carts are left.',
      },
      new_products: {
        label: 'Launch new products',
        body: 'Email subscribers about products added in the last 14 days.',
      },
      win_back: {
        label: 'Win back customers',
        body: 'Bring back customers with no order in 90 days.',
      },
      festive: {
        label: 'Festive sales',
        body: 'A campaign a few days before Diwali, Holi, Raksha Bandhan and other sale days.',
      },
    },
    budgetLabel: 'Budget',
    messages: 'Emails per week',
    messagesHelp: 'Campaigns that would go past this are not planned.',
    campaigns: 'Campaigns per week',
    discount: 'Largest discount (%)',
    discountHelp:
      '0 means Autopilot never offers a code. Codes work once per customer for 14 days.',
    save: 'Save',
    saved: 'Autopilot settings saved',
  },
  proposals: {
    title: 'Proposed campaigns',
    subtitle: 'Each one is a draft you can open and edit. Approve to schedule it, or dismiss it.',
    plan: 'Plan campaigns',
    planning: 'Planning…',
    planned: (n: number) =>
      n === 0 ? 'Nothing new to plan right now' : `${n} new ${n === 1 ? 'proposal' : 'proposals'}`,
    lastPlanned: 'Last planned',
    offHint: 'Turn Autopilot on to plan campaigns.',
    empty:
      'No proposals yet. Choose Plan campaigns and Autopilot looks at your carts, products, customers and the festival calendar.',
    approve: 'Approve & schedule',
    turnOn: 'Approve & turn on',
    dismiss: 'Dismiss',
    open: 'Open draft',
    approved: 'Scheduled. It goes out at the time shown.',
    automationOn: 'Cart reminders are on',
    dismissed: 'Proposal dismissed',
    aiWritten: 'Written with AI',
    template: 'Built-in template',
    sendAt: (when: string) => `Sends ${when}`,
    audience: (n: string) => `${n} recipients`,
    discount: (pct: number) => `${pct}% off code`,
    noDiscount: 'No discount',
    allSubscribers: 'All subscribers',
    statuses: { proposed: 'Waiting', scheduled: 'Approved', dismissed: 'Dismissed' },
    goals: {
      recover_carts: {
        title: 'Turn on abandoned-checkout reminders',
        reason: (carts: string, value: string) =>
          `${carts} checkouts worth ${value} were left in the last 7 days and no reminder goes out.`,
      },
      new_products: {
        title: 'Announce new products',
        reason: (products: string) => `${products} new products were added in the last 14 days.`,
      },
      win_back: {
        title: 'Win back customers',
        reason: (customers: string) =>
          `${customers} subscribed customers have not ordered in 90 days.`,
      },
      festive: {
        title: 'Festive sale',
        reason: (festival: string) =>
          `${festival} is coming up. Shoppers plan their buying a few days before.`,
      },
    },
  },
  ads: {
    title: 'Ad channels',
    subtitle:
      'Autopilot will also move ad budget between channels once your ad accounts are connected.',
    meta: 'Meta (Facebook & Instagram)',
    google: 'Google Ads',
    soon: {
      meta: 'Coming with the Facebook & Instagram app',
      google: 'Coming with the Google app',
    },
  },
  learnMore: 'How Autopilot works',
  failed: 'That did not work. Please try again.',
} as const
