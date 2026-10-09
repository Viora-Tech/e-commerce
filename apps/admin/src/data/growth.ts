import type { OverviewChannel, SourceKey } from '@commerce/api'
import { routes } from '@/lib/routes'

/** Copy for the Growth section (was Marketing): campaigns, automations, links. */
export const growthContent = {
  index: {
    heading: 'Growth',
    body: 'Campaigns and automations that bring shoppers back: email, WhatsApp and discount-led promotions.',
    action: { label: 'View discounts', href: routes.discounts.list() },
  },
  campaigns: {
    heading: 'No campaigns',
    body: 'A campaign is a one-off send to a segment of your customers: a launch, a sale or a restock.',
    action: { label: 'View discounts', href: routes.discounts.list() },
  },
  automations: {
    heading: 'No automations',
    body: 'Automations run on their own: abandoned-checkout reminders, post-purchase follow-ups, win-back messages.',
    action: { label: 'Notification settings', href: routes.settings.notifications() },
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

/** Friendly, merchant-facing name per normalised source (plain words, no jargon). */
export const SOURCE_LABELS: Record<SourceKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  google: 'Google',
  whatsapp: 'WhatsApp',
  ai_assistant: 'AI assistants',
  email: 'Email',
  direct: 'Direct',
  other: 'Other',
}

export const growthOverviewContent = {
  title: 'Growth',
  intro: 'How much you are selling from Instagram, Google, WhatsApp, AI assistants and direct.',
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
  view: {
    label: 'View',
    bySource: 'By source',
    byChannel: 'By channel',
  },
  bestSource: {
    /** {source} is filled in with the friendly source label. */
    title: 'Your best source this period is {source}',
    body: 'It brought in the most sales of anything other than direct traffic.',
  },
  sources: {
    title: 'Sales by source',
    empty:
      'No sessions in this range yet. Sources appear here as shoppers arrive from Instagram, Google, WhatsApp, AI assistants and more. Tag your links on the Links page so each one shows up correctly.',
    columns: {
      source: 'Source',
      sessions: 'Sessions',
      orders: 'Orders',
      sales: 'Sales',
      conversion: 'Conversion',
      share: 'Share of sales',
    },
    campaignsUnder: 'Campaigns from this source',
    noCampaigns: 'No tagged links or campaigns from this source yet.',
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
      href: routes.growth.campaigns(),
    },
    automations: {
      title: 'Automations',
      body: 'Recover abandoned checkouts, welcome subscribers and win back lapsed buyers.',
      href: routes.growth.automations(),
    },
    links: {
      title: 'Links',
      body: 'Build a tagged link for your Instagram bio, a WhatsApp broadcast or an ad.',
      href: routes.growth.links(),
    },
    discounts: {
      title: 'Discounts',
      body: 'Create codes to use in campaigns and automations.',
      href: routes.discounts.list(),
    },
  },
} as const

/** Where a merchant will paste a tagged link: maps to utm_source / utm_medium. */
export const LINK_PLACEMENTS = [
  { id: 'instagram_bio', label: 'Instagram bio', source: 'instagram', medium: 'bio' },
  { id: 'instagram_story', label: 'Instagram story', source: 'instagram', medium: 'social' },
  { id: 'whatsapp_broadcast', label: 'WhatsApp broadcast', source: 'whatsapp', medium: 'whatsapp' },
  { id: 'facebook_post', label: 'Facebook post', source: 'facebook', medium: 'social' },
  { id: 'google_ads', label: 'Google ads', source: 'google', medium: 'cpc' },
  { id: 'influencer', label: 'Influencer', source: 'influencer', medium: 'influencer' },
  { id: 'other', label: 'Somewhere else', source: 'other', medium: 'referral' },
] as const
export type LinkPlacementId = (typeof LINK_PLACEMENTS)[number]['id']

export const growthLinksContent = {
  title: 'Links',
  intro:
    'Build a link that is tagged with where you shared it, so Growth can show you what it sold. Paste the tagged link wherever you post it.',
  form: {
    pageLabel: 'Page to link to',
    pagePlaceholder: '/products/your-product',
    pageHelp: 'A path on your store, like /products/hoodie or / for the homepage.',
    placementLabel: 'Where will you share it?',
    campaignLabel: 'Campaign name (optional)',
    campaignPlaceholder: 'e.g. diwali-drop',
    campaignHelp: 'Group several links together to see them as one campaign in Growth.',
  },
  result: {
    title: 'Your tagged link',
    copy: 'Copy link',
    copied: 'Copied',
    empty: 'Fill in a page and where you will share it to get a tagged link.',
  },
} as const
