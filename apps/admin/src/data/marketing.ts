import type { OverviewChannel } from '@commerce/api'

/** Copy for the Marketing section. */
export const marketingContent = {
  index: {
    heading: 'Marketing',
    body: 'Campaigns and automations that bring shoppers back: email, WhatsApp and discount-led promotions.',
    action: { label: 'View discounts', href: '/discounts' },
  },
  campaigns: {
    heading: 'No campaigns',
    body: 'A campaign is a one-off send to a segment of your customers: a launch, a sale or a restock.',
    action: { label: 'View discounts', href: '/discounts' },
  },
  automations: {
    heading: 'No automations',
    body: 'Automations run on their own: abandoned-checkout reminders, post-purchase follow-ups, win-back messages.',
    action: { label: 'Notification settings', href: '/settings/notifications' },
  },
} as const

export const CHANNEL_LABELS: Record<OverviewChannel, string> = {
  direct: 'Direct',
  organic_search: 'Organic search',
  paid_search: 'Paid search',
  social: 'Social',
  paid_social: 'Paid social',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  ai_assistant: 'AI assistants',
  referral: 'Referral',
  affiliate: 'Affiliates',
  other_paid: 'Other paid',
  untracked: 'Not tracked',
}

export const marketingOverviewContent = {
  title: 'Marketing',
  intro: 'Where your sessions and sales come from, and which campaigns earned them.',
  createCampaign: 'Create campaign',
  kpis: {
    sessions: {
      label: 'Sessions',
      help: 'Counted from the first storefront visit after this was switched on.',
    },
    attributed_sales: {
      label: 'Sales attributed to marketing',
      help: 'Orders whose last non-direct visit came from a channel or campaign.',
    },
    attributed_orders: {
      label: 'Orders attributed to marketing',
      help: 'Orders credited to a channel other than direct.',
    },
    conversion: {
      label: 'Conversion rate',
      help: 'Tracked orders divided by sessions.',
    },
  },
  salesOverTime: {
    title: 'Attributed sales over time',
    day: 'Daily',
    week: 'Weekly',
    series: 'Attributed sales',
  },
  channels: {
    title: 'Sessions and sales by channel',
    empty:
      'No sessions in this range yet. Channels appear here as shoppers arrive from search, social, email and WhatsApp.',
    columns: {
      channel: 'Channel',
      sessions: 'Sessions',
      orders: 'Orders',
      sales: 'Sales',
      conversion: 'Conversion',
    },
  },
  campaigns: {
    title: 'Top campaigns',
    empty:
      'Nothing to show yet. Tag links with utm_campaign, or send an email or WhatsApp campaign, and results land here.',
    columns: {
      campaign: 'Campaign',
      source: 'Source / medium',
      sessions: 'Sessions',
      orders: 'Orders',
      sales: 'Sales',
    },
    kinds: {
      email: 'Email',
      whatsapp: 'WhatsApp',
      automation: 'Automation',
      utm: 'Tagged link',
    },
  },
  shortcuts: {
    title: 'Reach your customers',
    campaigns: {
      title: 'Campaigns',
      body: 'Send an email or WhatsApp broadcast to a customer segment.',
      href: '/marketing/campaigns',
    },
    automations: {
      title: 'Automations',
      body: 'Recover abandoned checkouts, welcome subscribers and win back lapsed buyers.',
      href: '/marketing/automations',
    },
    discounts: {
      title: 'Discounts',
      body: 'Create codes to use in campaigns and automations.',
      href: '/discounts',
    },
  },
} as const
