/**
 * Sales channels (admin → Agentic sales, Social media): which channels exist, how an order's
 * attribution maps to one, and the settings kept on `store.preferences.salesChannels`. Pure
 * and client-safe, so admin components import it through `@commerce/core/sales-channels`.
 */
import { z } from 'zod'

/** AI shopping assistants that read the catalog through their own commerce protocol. */
export const AI_AGENTS = ['chatgpt', 'google_ai', 'perplexity', 'copilot'] as const
export type AiAgent = (typeof AI_AGENTS)[number]

/** Social and messaging channels that sync the catalog. */
export const SOCIAL_CHANNELS = ['instagram', 'facebook', 'whatsapp', 'google'] as const
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number]

export type SalesChannelId = AiAgent | SocialChannel

export const isSocialChannel = (v: unknown): v is SocialChannel =>
  typeof v === 'string' && (SOCIAL_CHANNELS as readonly string[]).includes(v)

export const isAiAgent = (v: unknown): v is AiAgent =>
  typeof v === 'string' && (AI_AGENTS as readonly string[]).includes(v)

type Rule = { hosts: string[]; sources: string[] }

/** Referring hosts and `utm_source` values that mean "came from this channel". */
const RULES: Record<SalesChannelId, Rule> = {
  chatgpt: {
    hosts: ['chatgpt.com', 'chat.openai.com'],
    sources: ['chatgpt', 'chatgpt.com', 'openai'],
  },
  google_ai: { hosts: ['gemini.google.com'], sources: ['gemini', 'google_ai_mode'] },
  perplexity: { hosts: ['perplexity.ai'], sources: ['perplexity', 'perplexity.ai'] },
  copilot: { hosts: ['copilot.microsoft.com'], sources: ['copilot', 'bing_copilot'] },
  instagram: { hosts: ['instagram.com'], sources: ['instagram', 'ig'] },
  facebook: { hosts: ['facebook.com', 'fb.com', 'fb.me'], sources: ['facebook', 'fb'] },
  whatsapp: { hosts: ['whatsapp.com', 'wa.me'], sources: ['whatsapp', 'wa'] },
  // Free listings and Shopping ads tag themselves google / (organic_)shopping.
  google: { hosts: [], sources: [] },
}

const GOOGLE_SHOPPING_MEDIUMS = ['organic_shopping', 'shopping', 'product_sync', 'free_listings']

const onHost = (host: string, hosts: string[]) =>
  hosts.some((h) => host === h || host.endsWith(`.${h}`))

/** The fields of an order's attribution the channel rules read. */
export type ChannelAttribution = {
  channel?: string | undefined
  source?: string | undefined
  medium?: string | undefined
  referrer?: string | undefined
}

/** The sales channel an order came through, or null when it is none of them. */
export function channelOfAttribution(
  a: ChannelAttribution | null | undefined,
): SalesChannelId | null {
  if (!a) return null
  const host = (a.referrer ?? '').toLowerCase().replace(/^www\./, '')
  const source = (a.source ?? '').toLowerCase()
  const medium = (a.medium ?? '').toLowerCase()
  if (source === 'google' && GOOGLE_SHOPPING_MEDIUMS.includes(medium)) return 'google'
  for (const id of [...AI_AGENTS, ...SOCIAL_CHANNELS]) {
    const rule = RULES[id]
    if ((host && onHost(host, rule.hosts)) || (source && rule.sources.includes(source))) return id
  }
  if (a.channel === 'whatsapp') return 'whatsapp'
  return null
}

/** What a connected agent may read or send back (Figma "Connect an AI agent", step 2). */
export const AGENT_SHARES = ['catalog', 'prices', 'policies', 'orders', 'marketing'] as const
export type AgentShare = (typeof AGENT_SHARES)[number]

/**
 * Where a channel's connection stands. `requested`: Connect is done and the platform (Meta,
 * Google, OpenAI) has not approved it yet, so nothing is shared. After approval the
 * integration moves it through `first_sync` → `connected`, with `syncing` while it sends,
 * `error` when a sync fails, `expired` when the platform's access lapsed, `disconnected` when
 * the merchant or the platform ended it, and `paused` when listings were paused on purpose.
 */
export const CHANNEL_STATUSES = [
  'not_connected',
  'requested',
  'first_sync',
  'connected',
  'syncing',
  'error',
  'expired',
  'disconnected',
  'paused',
] as const
export type ChannelConnection = (typeof CHANNEL_STATUSES)[number]

/** The last sync, as the integration reports it; every field is optional until one ran. */
const ChannelSyncSchema = z.object({
  /** Products sent so far in the current or last sync, and how many it is sending. */
  sent: z.number().int().min(0).nullable().catch(null),
  total: z.number().int().min(0).nullable().catch(null),
  startedAt: z.string().nullable().catch(null),
  /** When it last tried (a failed sync still counts). */
  lastTriedAt: z.string().nullable().catch(null),
  /** When access lapsed or the connection ended, for "Access was removed on 13 Oct". */
  endedAt: z.string().nullable().catch(null),
  /** The platform's own words for a failure, when it gave any. */
  message: z.string().max(300).nullable().catch(null),
})
export type ChannelSync = z.infer<typeof ChannelSyncSchema>

const EMPTY_SYNC: ChannelSync = {
  sent: null,
  total: null,
  startedAt: null,
  lastTriedAt: null,
  endedAt: null,
  message: null,
}

const ChannelStateSchema = z.object({
  status: z.enum(CHANNEL_STATUSES).catch('not_connected'),
  requestedAt: z.string().nullable().catch(null),
  shares: z.array(z.enum(AGENT_SHARES)).catch([]),
  /** The account picked in Connect (an Instagram handle, a WhatsApp number). */
  account: z.string().max(120).nullable().catch(null),
  /** Social channels: every active product, or only collections picked after approval. */
  catalog: z.enum(['all', 'collections']).catch('all'),
  sync: ChannelSyncSchema.catch(EMPTY_SYNC),
})
export type ChannelState = z.infer<typeof ChannelStateSchema>

export const NOT_CONNECTED: ChannelState = {
  status: 'not_connected',
  requestedAt: null,
  shares: [],
  account: null,
  catalog: 'all',
  sync: EMPTY_SYNC,
}

/** The connection needs the merchant: a failed sync, lapsed access or an ended connection. */
export const needsReconnect = (s: ChannelState): boolean =>
  s.status === 'error' || s.status === 'expired' || s.status === 'disconnected'

/** Approved and live in some form, so the channel can show products and take orders. */
export const isLive = (s: ChannelState): boolean =>
  s.status !== 'not_connected' && s.status !== 'requested'

/** Figma "Agent controls": what agents may show, at what price, and how shoppers pay. */
export const AgentControlsSchema = z.object({
  visibility: z.enum(['all', 'collections']).catch('all'),
  collectionIds: z.array(z.string().uuid()).max(200).catch([]),
  hideTagged: z.boolean().catch(true),
  hiddenTags: z.array(z.string().trim().min(1).max(60)).max(30).catch(['no-ai']),
  storePrices: z.boolean().catch(true),
  showCompareAt: z.boolean().catch(true),
  checkout: z.enum(['agent', 'store']).catch('store'),
  holdLarge: z.boolean().catch(false),
  holdAbovePaise: z.number().int().min(0).max(1_000_000_000).catch(2_500_000),
})
export type AgentControls = z.infer<typeof AgentControlsSchema>

export const defaultAgentControls: AgentControls = AgentControlsSchema.parse({})

const SalesChannelsSchema = z.object({
  agents: AgentControlsSchema.catch(defaultAgentControls),
  channels: z.record(z.string(), ChannelStateSchema).catch({}),
})
export type SalesChannelsSettings = z.infer<typeof SalesChannelsSchema>

/** `store.preferences.salesChannels`, with defaults for anything missing or broken. */
export function parseSalesChannels(preferences: unknown): SalesChannelsSettings {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as Record<string, unknown>).salesChannels
      : undefined
  const r = SalesChannelsSchema.safeParse(raw ?? {})
  return r.success ? r.data : { agents: defaultAgentControls, channels: {} }
}

export const channelState = (s: SalesChannelsSettings, id: SalesChannelId): ChannelState =>
  s.channels[id] ?? NOT_CONNECTED

/** The input of "Connect": what the merchant picked before asking for access. */
export const ConnectRequestSchema = z.object({
  channel: z.enum([...AI_AGENTS, ...SOCIAL_CHANNELS]),
  shares: z.array(z.enum(AGENT_SHARES)).max(AGENT_SHARES.length).default([]),
  account: z.string().trim().max(120).nullable().default(null),
  catalog: z.enum(['all', 'collections']).default('all'),
})
export type ConnectRequest = z.infer<typeof ConnectRequestSchema>

/* ---------- catalog readiness ---------- */

export type ReadinessSeverity = 'high' | 'medium' | 'low'
export const READINESS_SEVERITIES: readonly ReadinessSeverity[] = ['high', 'medium', 'low']

/** What the issue row's button does. */
export type ReadinessFix = 'ai' | 'gtin' | 'images' | 'attributes' | 'policy' | 'shipping'

export type ReadinessIssue = {
  id: string
  severity: ReadinessSeverity
  kind: 'product' | 'policy'
  /** The product's or policy's title. */
  title: string
  /** Product id, or the policy type. */
  ref: string
  rule: ReadinessRule
  fix: ReadinessFix
  /** Numbers the copy needs (word count, image count). */
  n?: number | undefined
}

export type ReadinessRule =
  | 'no_description'
  | 'short_description'
  | 'no_identifier'
  | 'no_images'
  | 'few_images'
  | 'no_category'
  | 'no_refund_policy'
  | 'no_shipping_policy'
  | 'no_terms'

export type ReadinessPart = 'details' | 'descriptions' | 'images' | 'policies'
export const READINESS_PARTS: readonly ReadinessPart[] = [
  'details',
  'descriptions',
  'images',
  'policies',
]

export type CatalogReadiness = {
  /** 0–100, the mean of the four parts. */
  score: number
  parts: Record<ReadinessPart, number>
  products: number
  counts: Record<ReadinessSeverity, number>
  issues: ReadinessIssue[]
  /** Products whose description "Fix with AI" can write. */
  aiFixable: string[]
}
