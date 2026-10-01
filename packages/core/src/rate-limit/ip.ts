/**
 * The client IP that per-IP rate limits key on. Which header to believe depends on the
 * deployment, so it is a setting (`TRUSTED_PROXY`, security audit D-01):
 *
 * - `cloudflare`: Cloudflare sets `cf-connecting-ip`. Safe ONLY when the origin accepts
 *   connections from Cloudflare's IP ranges alone (the Lightsail firewall); otherwise anyone
 *   can send the header and get a fresh bucket per request.
 * - `none` (default): no forwarded header is believed (`cf-connecting-ip`, `x-forwarded-for`
 *   and `x-real-ip` are all client-supplied). The caller passes the socket's peer address
 *   when its framework exposes one (the worker does); a Next.js server action does not get
 *   one, so every such request shares the `unknown` bucket. That fails safe: limits get
 *   tighter, never bypassable, and the per-account and per-destination limits still apply.
 *
 * Never trust this for anything beyond rate limiting.
 */

export type TrustedProxy = 'cloudflare' | 'none'

export type ClientIpOptions = {
  /** The TCP peer address, when the framework exposes it. */
  peer?: string | null
  /** Overrides `TRUSTED_PROXY` from the environment (tests). */
  trustedProxy?: TrustedProxy
}

/** `TRUSTED_PROXY` from an environment; anything but `cloudflare` means `none`. */
function trustedProxyFrom(env: Record<string, string | undefined>): TrustedProxy {
  return env.TRUSTED_PROXY?.trim().toLowerCase() === 'cloudflare' ? 'cloudflare' : 'none'
}

/** Strips an IPv4-mapped IPv6 prefix and surrounding space; empty or junk becomes null. */
function cleanAddress(raw: string | null | undefined): string | null {
  const v = raw?.trim()
  if (!v || v.length > 64 || !/^[0-9a-fA-F:.]+$/.test(v)) return null
  return v.startsWith('::ffff:') && v.includes('.') ? v.slice('::ffff:'.length) : v
}

export function clientIp(
  headers: { get(name: string): string | null },
  options: ClientIpOptions = {},
): string {
  const mode = options.trustedProxy ?? trustedProxyFrom(process.env)
  if (mode === 'cloudflare') {
    const cf = cleanAddress(headers.get('cf-connecting-ip'))
    if (cf) return cf
  }
  const peer = cleanAddress(options.peer)
  if (!peer && mode === 'none' && process.env.NODE_ENV === 'production') warnSharedBucketOnce()
  return peer ?? 'unknown'
}

let warned = false

/** Production with no trusted proxy: every shopper shares one per-IP bucket. Say so once. */
function warnSharedBucketOnce(): void {
  if (warned) return
  warned = true
  console.warn(
    '[rate-limit] TRUSTED_PROXY is none and this request has no peer address: per-IP limits ' +
      'share one bucket. Set TRUSTED_PROXY=cloudflare behind a Cloudflare-locked origin.',
  )
}
