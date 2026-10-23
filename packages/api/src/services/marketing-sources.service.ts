/**
 * Friendly traffic sources for Growth (Instagram, Google, WhatsApp...), shared by the overview's
 * "by source" table and its campaign drill-down.
 */

/**
 * A source normalised to something a non-technical merchant recognises, so
 * the overview can answer "how much am I selling from Instagram/Google/
 * WhatsApp/ChatGPT/direct" without them knowing what a UTM parameter is.
 */
export const SOURCE_KEYS = [
  'instagram',
  'facebook',
  'youtube',
  'google',
  'whatsapp',
  'ai_assistant',
  'email',
  'direct',
  'other',
] as const
export type SourceKey = (typeof SOURCE_KEYS)[number]

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

/**
 * Normalises a source/medium/channel/referrer combination to a name a
 * non-technical merchant recognises. UTM tags win (a merchant who tagged
 * "instagram" meant Instagram); the channel and referrer are the fallback
 * for untagged organic and AI-assistant traffic.
 */
export function normalizeSource(input: {
  source: string | null
  medium: string | null
  referrer: string | null
  channel: string | null
}): SourceKey {
  const source = input.source?.toLowerCase() ?? ''
  const medium = input.medium?.toLowerCase() ?? ''
  const referrer = input.referrer?.toLowerCase() ?? ''
  const has = (needle: string) => source.includes(needle) || referrer.includes(needle)
  if (has('instagram') || source === 'ig') return 'instagram'
  if (has('facebook') || source === 'fb' || source === 'meta') return 'facebook'
  if (has('youtube') || source === 'yt') return 'youtube'
  if (has('google') || source === 'adwords' || source === 'googleads') return 'google'
  if (has('whatsapp') || source === 'wa' || medium === 'whatsapp' || input.channel === 'whatsapp')
    return 'whatsapp'
  if (
    has('chatgpt') ||
    has('openai') ||
    has('perplexity') ||
    has('gemini') ||
    has('claude.ai') ||
    has('copilot.microsoft') ||
    input.channel === 'ai_assistant'
  )
    return 'ai_assistant'
  if (has('mail.') || medium === 'email' || medium === 'newsletter' || input.channel === 'email')
    return 'email'
  if (!input.channel || input.channel === 'direct') return 'direct'
  return 'other'
}
