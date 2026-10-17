import { siteConfig } from '@commerce/config/site'
import type { PlanId } from '@commerce/core/billing'

/** Copy for Settings → Plan & billing and Compare plans (Figma 707:119179, 707:123189). */
export const billingContent = {
  title: 'Plan & billing',
  subtitle: `Your ${siteConfig.brand.name} plan, what your store used this month, and your invoices.`,
  compare: 'Compare plans',
  plans: {
    starter: { name: 'Starter', blurb: 'For a new shop finding its first customers.' },
    growth: { name: 'Growth', blurb: 'For a shop selling every day.' },
    pro: { name: 'Pro', blurb: 'For busy brands, with every app included.' },
  } satisfies Record<PlanId, { name: string; blurb: string }>,
  interval: { month: 'Monthly', year: 'Yearly' },
  perMonth: (price: string) => `${price} / month`,
  perYear: (price: string) => `${price} / year`,
  yearlySaving: '2 months free',
  gstExtra: '+ 18% GST',
  status: {
    trialing: 'Trial',
    active: 'Current',
    due: 'Payment due',
    paused: 'Paused',
    cancelled: 'Closed',
  },
  current: {
    heading: 'Current plan',
    trialEnds: (date: string, days: number) =>
      days <= 0
        ? `Trial ended on ${date}`
        : `Trial ends ${date} · ${days} ${days === 1 ? 'day' : 'days'} left`,
    renews: (date: string) => `Renews ${date}`,
    ended: (date: string) => `Paid until ${date}`,
    switching: (plan: string, date: string) => `Moves to ${plan} on ${date}.`,
    keep: 'Keep current plan',
    kept: 'You stay on your current plan',
    usageNote:
      'Usage resets on the 1st of each month. Orders over the limit are never blocked; we ask you to move up a plan first.',
  },
  usage: {
    orders: 'Orders this month',
    staff: 'Staff accounts',
    ai: 'AI requests',
    storage: 'File storage',
    of: (used: string, limit: string) => `${used} of ${limit}`,
    unlimited: 'No limit',
    gb: (gb: string) => `${gb} GB`,
  },
  over: {
    upgrade: (plan: string) => `You are past this plan’s orders. Move to ${plan} for more room.`,
    ownIt: 'You are past Pro’s orders. Own it gives you unlimited orders on your own server.',
  },
  banners: {
    trial: (days: number) =>
      `Your free trial ends in ${days} ${days === 1 ? 'day' : 'days'}. Pick a plan to keep selling without a break.`,
    trialOver: 'Your free trial is over. Pick a plan to keep your store running.',
    due: (amount: string, date: string) =>
      `${amount} is due for your plan. Pay by ${date} to keep everything running.`,
    paused:
      'Your plan is paused because the last bill was not paid. Pay it to switch everything back on.',
    choose: 'Pick a plan',
    pay: 'Pay now',
  },
  payment: {
    heading: 'Payment method',
    body: 'Each bill comes with a secure link. Pay it with UPI, a card or netbanking, and the plan starts as soon as it is paid.',
    autopay: 'UPI AutoPay is coming soon, so renewals pay themselves.',
    invoiceEmail: 'Invoices go to',
    invoiceEmailHelp: 'Your store’s contact email (Settings → Store details).',
    notReady: `Paying for plans online is not switched on yet. Contact ${siteConfig.brand.name} to change plans.`,
  },
  bills: {
    heading: 'Invoices',
    number: 'Invoice',
    date: 'Date',
    amount: 'Amount',
    status: 'Status',
    period: (plan: string, from: string, to: string) => `${plan} · ${from} – ${to}`,
    gst: 'incl. 18% GST',
    pay: 'Pay',
    view: 'View',
    states: { due: 'Due', paid: 'Paid', cancelled: 'Cancelled' },
    empty: 'No invoices yet',
    emptyBody: 'Your first invoice shows up here once you pick a plan.',
  },
  change: {
    heading: 'Downgrade or close',
    body: (plan: string, date: string) =>
      `Move to ${plan} any time. You keep everything until ${date}; after that ${plan} limits apply.`,
    action: (plan: string) => `Move to ${plan}`,
    confirmTitle: (plan: string) => `Move to ${plan}?`,
    confirmBody: (plan: string, date: string) =>
      `You keep your current plan until ${date}. Then ${plan}’s limits apply; orders are never blocked.`,
    confirm: 'Move down',
    cancel: 'Keep my plan',
    scheduled: (plan: string) => `You move to ${plan} when this period ends`,
  },
  dialog: {
    title: 'Compare plans',
    subtitle:
      'Every plan has GST invoices, couriers, UPI payments and a Hindi admin. Prices before GST.',
    current: 'Your plan',
    choose: (plan: string) => `Choose ${plan}`,
    switching: 'Opening payment…',
    failed: 'Could not start that plan. Try again.',
    scheduledToast: (plan: string) => `You move to ${plan} when this period ends`,
    rows: {
      orders: 'Orders a month',
      staff: 'Staff accounts',
      storage: 'File storage',
      ai: 'AI',
      shopifyTheme: 'Shopify theme import',
      mcpApi: 'MCP & API',
      multiLocation: 'Several locations',
      apps: 'Apps',
      support: 'Support',
    },
    ai: { starter: 'Light use', growth: 'Daily use', unlimited: 'Heavy use' },
    apps: { core: 'Core apps; buy others', all: 'All our apps included' },
    support: { email: 'Email', whatsapp: 'Email + WhatsApp', priority: 'Priority' },
    ownIt: {
      title: 'Own it',
      body: `Run ${siteConfig.brand.name} on your own server with unlimited orders. One-time licence plus a small monthly fee for updates and support.`,
      action: 'Talk to us',
    },
  },
  loadFailed: 'Could not load your plan. Try again.',
} as const
