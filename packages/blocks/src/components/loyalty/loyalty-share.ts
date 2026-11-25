/** SOURCE OF TRUTH: referral share links — WHAT: the networks the referral card can share to and the URL each opens with the shopper's link and message / WHY: one place builds them, so the widget, the Points page and the tests agree */

const LOYALTY_SHARE_NETWORKS = [
  'whatsapp',
  'email',
  'x',
  'facebook',
  'messenger',
  'threads',
  'telegram',
] as const

export type LoyaltyShareNetwork = (typeof LOYALTY_SHARE_NETWORKS)[number]

const enc = encodeURIComponent

/** The link a share button opens: the network's own share page with the referral link filled in. */
export function shareUrl(
  network: LoyaltyShareNetwork,
  input: { url: string; text: string; subject: string },
): string {
  const { url, text, subject } = input
  const message = `${text} ${url}`
  switch (network) {
    case 'whatsapp':
      return `https://wa.me/?text=${enc(message)}`
    case 'email':
      return `mailto:?subject=${enc(subject)}&body=${enc(message)}`
    case 'x':
      return `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`
    case 'messenger':
      // Opens the Messenger app on a phone; Facebook's web dialog needs an app id.
      return `fb-messenger://share/?link=${enc(url)}`
    case 'threads':
      return `https://www.threads.net/intent/post?text=${enc(message)}`
    case 'telegram':
      return `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`
  }
}

/** The program's share buttons when a store never chose (the settings default). */
const DEFAULT_SHARE_NETWORKS: LoyaltyShareNetwork[] = ['whatsapp', 'email', 'x', 'facebook']

/**
 * The share buttons to draw from the program's `referrals.shareChannels`: known networks only,
 * in the fixed order above; the default four when the setting is missing (an older program).
 */
export function shareNetworksOf(channels: unknown): LoyaltyShareNetwork[] {
  if (!Array.isArray(channels)) return [...DEFAULT_SHARE_NETWORKS]
  return LOYALTY_SHARE_NETWORKS.filter((n) => channels.includes(n))
}
