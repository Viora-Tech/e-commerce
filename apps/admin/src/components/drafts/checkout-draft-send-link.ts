/** Where a checkout draft's payment link went; matches the API's `channel`. */
export type LinkChannel = 'email' | 'whatsapp' | 'both'

export type LinkTooSoon = { channel: 'email' | 'whatsapp'; minutes: number }

const MINUTE_MS = 60_000

/**
 * The API's "sent on this channel less than 10 minutes ago" refusal (`TOO_MANY_REQUESTS`
 * carrying `{ channel, nextAt }`), as the channel and whole minutes left (at least 1), or null
 * for any other error.
 */
export function linkTooSoon(err: unknown, now: Date = new Date()): LinkTooSoon | null {
  const e = err as { code?: unknown; data?: { channel?: unknown; nextAt?: unknown } } | null
  if (e?.code !== 'TOO_MANY_REQUESTS') return null
  const channel = e.data?.channel
  if (channel !== 'email' && channel !== 'whatsapp') return null
  const nextAt = typeof e.data?.nextAt === 'string' ? new Date(e.data.nextAt) : null
  const left = nextAt && !Number.isNaN(nextAt.getTime()) ? nextAt.getTime() - now.getTime() : 0
  return { channel, minutes: Math.max(1, Math.ceil(left / MINUTE_MS)) }
}
