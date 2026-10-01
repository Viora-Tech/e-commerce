/**
 * A courier's API base URL, when a merchant overrides it (staging keys, a regional host).
 * Only https on the courier's own domain: the stored API token is sent to this address, so
 * any other host would receive it, and a private address would let the server be pointed
 * at the internal network.
 */
export function courierBaseUrlProblem(raw: string | undefined, domains: string[]): string | null {
  const value = raw?.trim()
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return 'base URL is not a valid address'
  }
  if (url.protocol !== 'https:') return 'base URL must start with https://'
  if (url.username || url.password || url.port) return 'base URL must not carry a port or login'
  const host = url.hostname.toLowerCase()
  const onDomain = domains.some((d) => host === d || host.endsWith(`.${d}`))
  return onDomain ? null : `base URL must be on ${domains.join(' or ')}`
}
