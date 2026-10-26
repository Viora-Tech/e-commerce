/**
 * Where a storefront visit came from. Pure: the storefront beacon, the order
 * workflow and the admin reports all read these rules, and client components
 * import them through `@commerce/core/marketing`.
 */

export const MARKETING_CHANNELS = [
  'direct',
  'organic_search',
  'paid_search',
  'social',
  'paid_social',
  'email',
  'whatsapp',
  'sms',
  'ai_assistant',
  'referral',
  'affiliate',
  'other_paid',
] as const
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number]

export type Attribution = {
  channel: MarketingChannel
  source?: string | undefined
  medium?: string | undefined
  campaign?: string | undefined
  content?: string | undefined
  term?: string | undefined
  /** Referring host, never the full URL (paths can carry personal data). */
  referrer?: string | undefined
  /** Path of the first page, without the query string. */
  landing?: string | undefined
  messageId?: string | undefined
  campaignId?: string | undefined
  automationId?: string | undefined
  /** The short link (Growth → Links) the visit came through. */
  linkId?: string | undefined
  /** An affiliate's referral code from `?ref=` (Affiliates app), lower-cased. */
  ref?: string | undefined
  /** ISO time of the touch. */
  at: string
}

/** How long a marketing touch keeps credit for a later direct visit (last non-direct click). */
export const ATTRIBUTION_WINDOW_DAYS = 30
/** A session ends after this much inactivity, as in Shopify and GA. */
export const SESSION_IDLE_MS = 30 * 60_000

const SEARCH_HOSTS = [
  'google.',
  'bing.com',
  'duckduckgo.com',
  'yahoo.',
  'yandex.',
  'baidu.com',
  'ecosia.org',
  'search.brave.com',
]
const SOCIAL_HOSTS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'l.instagram.com',
  't.co',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'lnkd.in',
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'pinterest.',
  'threads.net',
  'snapchat.com',
  'discord.com',
  'telegram.org',
  't.me',
  'quora.com',
]
const AI_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'claude.ai',
  'you.com',
  'meta.ai',
]
const WHATSAPP_HOSTS = ['whatsapp.com', 'wa.me', 'web.whatsapp.com']
const EMAIL_HOSTS = ['mail.google.com', 'outlook.live.com', 'mail.yahoo.com']

const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'cpm', 'display', 'ads']
const SOCIAL_SOURCES = [
  'facebook',
  'fb',
  'instagram',
  'ig',
  'meta',
  'twitter',
  'x',
  'linkedin',
  'youtube',
  'pinterest',
  'snapchat',
  'reddit',
]
const SEARCH_SOURCES = ['google', 'bing', 'duckduckgo', 'yahoo', 'adwords', 'googleads']

const hostMatches = (host: string, list: string[]) =>
  list.some((h) =>
    h.endsWith('.') ? host.includes(h) || host.startsWith(h) : host === h || host.endsWith(`.${h}`),
  )

const clip = (v: string | null | undefined, max = 120): string | undefined => {
  const t = v?.trim()
  return t ? t.slice(0, max) : undefined
}

/**
 * An affiliate's referral code from `?ref=` (Affiliates app): lower-case letters, digits and
 * hyphens, 3 to 32 long; anything else is not one of ours.
 */
export function refCodeOf(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase()
  return v && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(v) ? v : null
}

/** Lower-cased host without `www.`, or null for anything that is not an http(s) URL. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Channel for a set of UTM tags and a referring host. UTM tags win over the
 * referrer, because a merchant who tagged a link knows what it was.
 */
export function classifyChannel(input: {
  source?: string | undefined
  medium?: string | undefined
  referrerHost?: string | null | undefined
  clickIds?: { gclid?: boolean; fbclid?: boolean; msclkid?: boolean } | undefined
  marketingMessage?: boolean | undefined
}): MarketingChannel {
  const source = input.source?.toLowerCase() ?? ''
  const medium = input.medium?.toLowerCase() ?? ''
  if (input.marketingMessage) return medium === 'whatsapp' ? 'whatsapp' : 'email'
  if (medium === 'email' || medium === 'newsletter' || source === 'newsletter') return 'email'
  if (medium === 'whatsapp' || source === 'whatsapp' || source === 'wa') return 'whatsapp'
  if (medium === 'sms' || source === 'sms') return 'sms'
  if (medium === 'affiliate' || medium === 'partner' || medium === 'influencer') return 'affiliate'
  const paid = PAID_MEDIUMS.includes(medium) || medium.startsWith('paid')
  if (paid && (SOCIAL_SOURCES.includes(source) || medium === 'paid_social')) return 'paid_social'
  if (paid && (SEARCH_SOURCES.includes(source) || medium === 'paid_search')) return 'paid_search'
  if (input.clickIds?.gclid || input.clickIds?.msclkid) return 'paid_search'
  if (paid) return 'other_paid'
  if (medium === 'social' || medium === 'organic_social' || SOCIAL_SOURCES.includes(source)) {
    return 'social'
  }
  if (medium === 'organic' || SEARCH_SOURCES.includes(source)) return 'organic_search'
  const host = input.referrerHost
  if (host) {
    if (hostMatches(host, AI_HOSTS)) return 'ai_assistant'
    if (hostMatches(host, WHATSAPP_HOSTS)) return 'whatsapp'
    if (hostMatches(host, EMAIL_HOSTS)) return 'email'
    if (hostMatches(host, SEARCH_HOSTS)) return 'organic_search'
    if (hostMatches(host, SOCIAL_HOSTS)) return input.clickIds?.fbclid ? 'paid_social' : 'social'
    return 'referral'
  }
  if (source) return 'referral'
  return 'direct'
}

/**
 * Attribution for a landing page and its referrer. The referrer counts only
 * when it is another site; navigating within the store is not a source.
 * `marketing` carries the ids a tracked email link resolved to.
 */
export function attributionFromVisit(input: {
  landingUrl: string
  referrer?: string | null | undefined
  storeHost?: string | null | undefined
  marketing?: {
    messageId: string
    campaignId?: string | undefined
    automationId?: string | undefined
  }
  /** Set when the visit came through a short link (`/l/<slug>`). */
  linkId?: string | undefined
  now?: Date | undefined
}): Attribution {
  let params = new URLSearchParams()
  let landing: string | undefined
  try {
    const u = new URL(input.landingUrl)
    params = u.searchParams
    landing = clip(u.pathname, 200)
  } catch {
    // A malformed URL is a direct visit to an unknown page.
  }
  const refHost = hostOf(input.referrer)
  const ownHost = input.storeHost
    ?.toLowerCase()
    .replace(/^www\./, '')
    .split(':')[0]
  const externalRef = refHost && refHost !== ownHost ? refHost : null
  const source = clip(params.get('utm_source'))
  const medium = clip(params.get('utm_medium'))
  const classified = classifyChannel({
    source,
    medium,
    referrerHost: externalRef,
    clickIds: {
      gclid: params.has('gclid'),
      fbclid: params.has('fbclid'),
      msclkid: params.has('msclkid'),
    },
    marketingMessage: Boolean(input.marketing),
  })
  // A short link is never a direct visit: untagged and opened from an app (no referrer), it
  // still came from wherever the merchant shared it, and must not lose to an older touch.
  const linked = classified === 'direct' && input.linkId ? 'referral' : classified
  // An affiliate's link is the affiliate's sale, unless the merchant tagged it otherwise.
  const ref = refCodeOf(params.get('ref'))
  const untagged = linked === 'direct' || linked === 'referral' || linked === 'social'
  const channel = ref && untagged ? 'affiliate' : linked
  return {
    channel,
    source: source ?? externalRef ?? undefined,
    medium,
    campaign: clip(params.get('utm_campaign')),
    content: clip(params.get('utm_content')),
    term: clip(params.get('utm_term')),
    referrer: externalRef ?? undefined,
    landing,
    messageId: input.marketing?.messageId,
    campaignId: input.marketing?.campaignId,
    automationId: input.marketing?.automationId,
    linkId: input.linkId,
    ref: ref ?? undefined,
    at: (input.now ?? new Date()).toISOString(),
  }
}

/**
 * The touch a cart and its order should carry: the newest non-direct touch
 * while it is inside the window, otherwise whatever this visit was. A direct
 * return visit never wipes the email or ad that brought the shopper.
 */
export function pickAttribution(
  current: Attribution,
  previous: Attribution | null | undefined,
  now: Date = new Date(),
): Attribution {
  if (current.channel !== 'direct' || !previous) return current
  const age = now.getTime() - new Date(previous.at).getTime()
  if (previous.channel !== 'direct' && age >= 0 && age < ATTRIBUTION_WINDOW_DAYS * 86_400_000) {
    return previous
  }
  return current
}

/** Cookie form: base64url JSON. Anything unreadable is treated as absent. */
export function encodeAttribution(a: Attribution): string {
  return Buffer.from(JSON.stringify(a), 'utf8').toString('base64url')
}

export function decodeAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const v = JSON.parse(json) as Partial<Attribution>
    if (!v || typeof v !== 'object') return null
    if (
      typeof v.channel !== 'string' ||
      !(MARKETING_CHANNELS as readonly string[]).includes(v.channel)
    )
      return null
    if (typeof v.at !== 'string' || Number.isNaN(new Date(v.at).getTime())) return null
    const str = (x: unknown, max = 200) =>
      typeof x === 'string' && x ? x.slice(0, max) : undefined
    return {
      channel: v.channel as MarketingChannel,
      source: str(v.source),
      medium: str(v.medium),
      campaign: str(v.campaign),
      content: str(v.content),
      term: str(v.term),
      referrer: str(v.referrer),
      landing: str(v.landing),
      messageId: str(v.messageId, 40),
      campaignId: str(v.campaignId, 40),
      automationId: str(v.automationId, 40),
      linkId: str(v.linkId, 40),
      ref: refCodeOf(str(v.ref, 40)) ?? undefined,
      at: v.at,
    }
  } catch {
    return null
  }
}

/** Strips undefined keys so the JSON stored on carts and orders stays small. */
export function compactAttribution(a: Attribution): Attribution {
  return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) as Attribution
}

/**
 * An affiliate link click (Affiliates app), kept in its own first-party cookie whatever the
 * shopper chose on the consent banner: the sale belongs to the affiliate who sent them, which
 * is the store's agreement with that affiliate, not analytics. Holds the code and the click
 * time only, nothing about the shopper.
 */
export type Referral = { code: string; at: Date }

/** Cookie form: `<code>.<click time in epoch seconds>`. */
export function encodeReferral(r: Referral): string {
  return `${r.code}.${Math.floor(r.at.getTime() / 1000)}`
}

export function decodeReferral(raw: string | null | undefined): Referral | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 0) return null
  const code = refCodeOf(raw.slice(0, dot))
  const seconds = Number(raw.slice(dot + 1))
  if (!code || !Number.isInteger(seconds) || seconds <= 0) return null
  return { code, at: new Date(seconds * 1000) }
}

/**
 * The touch a cart and order carry once the referral cookie is counted in. Last click wins, as
 * with every other touch: a later non-direct touch from the analytics cookie (an email, an ad,
 * or the same affiliate link the beacon already saw) keeps its place; otherwise, including for a
 * shopper who said no to analytics and so has no other touch, the affiliate click is the touch.
 */
export function withReferral(
  attribution: Attribution | null,
  referral: Referral | null,
): Attribution | null {
  if (!referral) return attribution
  if (attribution && attribution.channel !== 'direct') {
    const at = new Date(attribution.at).getTime()
    if (at >= referral.at.getTime()) return attribution
  }
  return { channel: 'affiliate', ref: referral.code, at: referral.at.toISOString() }
}
