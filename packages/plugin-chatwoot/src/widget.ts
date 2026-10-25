/**
 * What the storefront's chat widget needs, with no zod and no database: the consent manager
 * imports it on every page. The widget is Chatwoot's own SDK (`<baseUrl>/packs/js/sdk.js`),
 * loaded from the store's Chatwoot; nothing of Chatwoot is bundled here.
 */

/** The cookie category the widget waits for (Settings → Customer privacy's banner). */
export const CHATWOOT_CONSENT = ['necessary', 'analytics', 'marketing'] as const
export type ChatwootConsent = (typeof CHATWOOT_CONSENT)[number]

export type ChatwootWidget = {
  /** The normalised Chatwoot address. */
  baseUrl: string
  websiteToken: string
  consent: ChatwootConsent
}

/** Values Chatwoot keeps as a contact's custom attributes. */
export type ChatwootAttributes = Record<string, string | number>

/**
 * A signed-in shopper, as the widget's `setUser` takes them. `identifierHash` is the HMAC of the
 * identifier with the inbox's secret, worked out on the server, so nobody can chat as someone
 * else by calling `setUser` with their id.
 */
export type ChatwootIdentity = {
  identifier: string
  identifierHash: string
  name: string | null
  email: string | null
  phone: string | null
  attributes: ChatwootAttributes
}

/**
 * Whether the widget may load for this shopper: always for `necessary`, otherwise once the
 * shopper allowed that category (`consent` null = not answered yet).
 */
export function chatwootAllowed(
  widget: ChatwootWidget,
  consent: { analytics: boolean; marketing: boolean } | null,
): boolean {
  if (widget.consent === 'necessary') return true
  return consent?.[widget.consent] === true
}
