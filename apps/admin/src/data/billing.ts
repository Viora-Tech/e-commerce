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
    scale: { name: 'Scale', blurb: 'For big brands: no per-order fee at all.' },
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
      'Usage resets on the 1st of each month. Orders are never blocked: each one past your plan’s included orders carries a small fee, billed on the 1st.',
    feeRate: (percent: string, orders: string) => `${percent}% per order after ${orders}`,
    noFee: 'No per-order fee',
  },
  fees: {
    heading: 'Per-order fees this month',
    feeOrders: 'Orders with a fee',
    estimate: 'Estimated fee so far',
    carried: (amount: string) => `Includes ${amount} carried from earlier months.`,
    trial: 'Orders during your free trial carry no fee.',
    note: 'Billed on the 1st with a pay link. Under ₹100, it waits for the next month.',
  },
  usage: {
    orders: 'Orders this month',
    staff: 'Staff accounts',
    ai: 'AI credits',
    storage: 'File storage',
    of: (used: string, limit: string) => `${used} of ${limit}`,
    unlimited: 'No limit',
    gb: (gb: string) => `${gb} GB`,
  },
  over: {
    upgrade: (plan: string) => `You are past this plan’s orders. Move to ${plan} for more room.`,
    ownIt:
      'You are past Scale’s orders. Talk to us about fair use, or Own it for unlimited orders on your own server.',
    fee: (percent: string) => `Each order from here carries a ${percent}% fee.`,
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
    unpaidFees: (amount: string) =>
      `${amount} of per-order fees is unpaid. Nothing is paused; if it is still unpaid at your next renewal, it is added to that bill.`,
    fairUse:
      'Your store had more visits than this plan’s fair use two months running. Nothing is blocked. We will get in touch to find the right plan with you.',
  },
  payment: {
    heading: 'Payment method',
    body: 'Each bill comes with a secure link. Pay it with UPI, a card or netbanking, and the plan starts as soon as it is paid.',
    autopay: 'UPI AutoPay is coming soon, so renewals pay themselves.',
    autopayOff:
      'Turn on UPI AutoPay and renewals pay themselves from your UPI app. You approve it once.',
    autopayOn:
      'UPI AutoPay is on. Each renewal is charged automatically and the invoice is emailed.',
    autopayPending: 'Approve the AutoPay mandate in your UPI app to finish turning it on.',
    autopayHalted:
      'AutoPay could not charge your last renewal. Pay the bill by link, or turn AutoPay on again.',
    autopayStart: 'Turn on UPI AutoPay',
    autopayApprove: 'Approve mandate',
    autopayStop: 'Turn off AutoPay',
    autopayStopped: 'AutoPay is off. Renewals come with a pay link again.',
    autopayFailed: 'Could not change AutoPay. Try again.',
    autopayFees: 'Per-order fees always come as a pay link, even with AutoPay on.',
    invoiceEmail: 'Invoices go to',
    invoiceEmailHelp: 'Your store’s contact email (Settings → Store details).',
    notReady: `Paying for plans online is not switched on yet. Contact ${siteConfig.brand.name} to change plans.`,
  },
  apps: {
    heading: 'Paid apps',
    help: 'Apps bought on top of your plan. Each renews monthly.',
    paidUntil: (date: string) => `Paid until ${date}`,
    endsOn: (date: string) => `Stops on ${date}`,
    due: (amount: string) => `${amount} due`,
    pay: 'Pay',
    stop: 'Stop renewing',
    stopTitle: (name: string) => `Stop renewing ${name}?`,
    stopBody: (name: string, date: string) =>
      `${name} keeps working until ${date}, then turns off. You can buy it again any time.`,
    keep: 'Keep it',
    stopped: (name: string) => `${name} will stop at the end of its paid month`,
    failed: 'Could not change this. Try again.',
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
  feeBills: {
    heading: 'Per-order fee bills',
    month: 'Month',
    orders: 'Orders with a fee',
    amount: 'Amount',
    status: 'Status',
    gst: '+ 18% GST',
    states: {
      carried: 'Carried over',
      due: 'Due',
      merged: 'Added to plan bill',
      paid: 'Paid',
      cancelled: 'Cancelled',
    },
    pay: 'Pay',
    view: 'View',
    csv: 'CSV',
    csvFailed: 'Could not download that. Try again.',
    empty: 'No per-order fees yet',
    emptyBody: 'A month with orders past your plan’s included ones shows up here.',
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
      orders: 'Orders included a month',
      fee: 'Fee per order after that',
      visits: 'Visits a month (fair use)',
      staff: 'Staff accounts',
      storage: 'File storage',
      ai: 'AI',
      shopifyTheme: 'Shopify theme import',
      mcpApi: 'MCP & API',
      multiLocation: 'Several locations',
      apps: 'Apps',
      support: 'Support',
    },
    ai: { starter: 'Light use', growth: 'Daily use', pro: 'Heavy use', scale: 'Very heavy use' },
    aiCredits: (n: string) => `${n} credits a month`,
    apps: { core: 'Core apps; buy others', all: 'All our apps included' },
    support: { email: 'Email', whatsapp: 'Email + WhatsApp', priority: 'Priority' },
    ownIt: {
      title: 'Own it',
      body: `Run ${siteConfig.brand.name} on your own server with unlimited orders. One-time licence plus a small monthly fee for updates and support.`,
      action: 'Talk to us',
      price: (licence: string, care: string) => `${licence} once + ${care} a month for care`,
    },
    fairUse: 'Fair use',
  },
  loadFailed: 'Could not load your plan. Try again.',
} as const
