/** SOURCE OF TRUTH: short link, /l/<slug>, link click, bot filter, shortLinkTarget
 * WHAT:  Pure rules for Growth → Links: what a slug may be, where a link lands (its store path
 *        with the UTM tags added), which requests are bots or link previews (not counted).
 * WHY:   The admin form, the API and the storefront redirect all apply the same rules.
 * WHERE: `packages/api/src/services/short-links.service.ts`, the storefront `/l/[slug]` route,
 *        `apps/admin/src/components/growth/links/*`.
 */

/** Lower-case letters, numbers and hyphens, starting with a letter or number, up to 60. */
export const SHORT_LINK_SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/

/** The storefront path a short link answers on. */
export const shortLinkPath = (slug: string) => `/l/${slug}`

export type ShortLinkTags = {
  utmSource?: string | null | undefined
  utmMedium?: string | null | undefined
  utmCampaign?: string | null | undefined
  utmContent?: string | null | undefined
  utmTerm?: string | null | undefined
}

/** "Diwali sale!" → "diwali-sale": a slug suggestion from a name. */
export function linkSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/**
 * The path part of where a link should go, or null when it leaves the store. Takes what the
 * merchant typed: a path (`/collections/glasspads`) or a full URL on one of `storeHosts`.
 */
export function storeDestination(input: string, storeHosts: string[]): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const u = new URL(raw, 'https://store.invalid')
    return `${u.pathname}${u.search}${u.hash}`
  }
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const ours = storeHosts.map(
    (h) =>
      h
        .toLowerCase()
        .replace(/^www\./, '')
        .split(':')[0],
  )
  if (!ours.includes(host)) return null
  return `${u.pathname}${u.search}${u.hash}`
}

const TAG_PARAMS: [keyof ShortLinkTags, string][] = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmContent', 'utm_content'],
  ['utmTerm', 'utm_term'],
]

/**
 * Where `/l/<slug>` sends the shopper: the destination path on `origin` with the link's UTM
 * tags added (a tag already written into the destination is kept as it is).
 */
export function shortLinkTarget(destination: string, tags: ShortLinkTags, origin: string): URL {
  const path = destination.startsWith('/') && !destination.startsWith('//') ? destination : '/'
  const url = new URL(path, origin)
  for (const [key, param] of TAG_PARAMS) {
    const value = tags[key]?.trim()
    if (value && !url.searchParams.has(param)) url.searchParams.set(param, value)
  }
  return url
}

/** The "utm_source=whatsapp · utm_campaign=diwali" line the Links table shows. */
export function tagSummary(tags: ShortLinkTags): string {
  return TAG_PARAMS.filter(([key]) => tags[key]?.trim())
    .map(([key, param]) => `${param}=${tags[key]?.trim()}`)
    .join(' · ')
}

/*
 * Crawlers, link-preview fetchers (WhatsApp, Facebook, X, Slack, Telegram, Discord, LinkedIn,
 * iMessage) and scripts. Sharing a link in WhatsApp fetches it once for the preview card; that
 * fetch is not a shopper.
 */
const BOT_UA =
  /(?:^|[^a-z])bot|bot(?:[^a-z]|$)|crawler|spider|crawling|preview|facebookexternalhit|facebookcatalog|whatsapp\/|slack-imgproxy|embedly|vkshare|quora link|headlesschrome|lighthouse|curl\/|wget\/|python-requests|python-urllib|httpclient|okhttp|go-http-client|axios\/|node-fetch|java\/|libwww|scrapy|feedfetcher|google-read-aloud|apple-pubsub|uptime|pingdom/i

/** Whether a request's User-Agent is a bot, a link preview or a script (or missing). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim()
  if (!ua) return true
  return BOT_UA.test(ua)
}
