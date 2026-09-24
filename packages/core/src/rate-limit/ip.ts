/**
 * Best-effort client IP from a request's headers. Cloudflare (in front of
 * both apps in production) sets `cf-connecting-ip`; `x-forwarded-for`'s first
 * hop is used behind anything else (dev, the worker's direct webhook path).
 * Never trust this for anything beyond rate limiting: it is attacker-supplied
 * off-platform.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  const real = headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}
