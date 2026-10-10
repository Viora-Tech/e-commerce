/**
 * Browser-safe hostname rules for custom domains. No database, no network:
 * the admin uses these to validate as the merchant types, and the service
 * re-runs them on the server before anything is written.
 */

/** Second-level suffixes where the registrable domain has three labels (`brand.co.in`). */
const MULTI_LABEL_SUFFIXES = new Set([
  'co.in',
  'net.in',
  'org.in',
  'firm.in',
  'gen.in',
  'ind.in',
  'ac.in',
  'edu.in',
  'res.in',
  'gov.in',
  'co.uk',
  'org.uk',
  'com.au',
  'net.au',
  'co.nz',
  'com.sg',
  'com.my',
  'co.za',
])

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/

export type HostnameResult = { ok: true; hostname: string } | { ok: false; error: string }

/**
 * What the merchant typed, reduced to a bare hostname: scheme, path, port,
 * `www.` kept (it is a separate hostname) but a trailing dot dropped, lower
 * case, IDN converted to punycode by the URL parser.
 */
export function normaliseHostname(input: string): HostnameResult {
  const raw = input.trim().toLowerCase()
  if (!raw) return { ok: false, error: 'Enter a domain, like yourstore.in' }
  let host: string
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `http://${raw}`).hostname
  } catch {
    return { ok: false, error: 'That does not look like a domain' }
  }
  host = host.replace(/\.$/, '')
  if (/^\d+(\.\d+){3}$/.test(host) || host.includes(':')) {
    return { ok: false, error: 'Enter a domain name, not an IP address' }
  }
  if (host.length > 253) return { ok: false, error: 'That domain is too long' }
  const labels = host.split('.')
  if (labels.length < 2) return { ok: false, error: 'Include the ending, like .in or .com' }
  if (!labels.every((l) => LABEL.test(l))) {
    return { ok: false, error: 'Domains can only use letters, numbers and hyphens' }
  }
  if (!TLD.test(labels[labels.length - 1] ?? '')) {
    return { ok: false, error: 'Include the ending, like .in or .com' }
  }
  return { ok: true, hostname: host }
}

/** The registrable domain (`brand.co.in`, `brand.com`) a hostname sits under. */
export function apexOf(hostname: string): string {
  const labels = hostname.split('.')
  const lastTwo = labels.slice(-2).join('.')
  const take = MULTI_LABEL_SUFFIXES.has(lastTwo) ? 3 : 2
  return labels.slice(-take).join('.')
}

/** True for `brand.com` and `brand.co.in`; false for `www.brand.com` or `shop.brand.com`. */
export function isApex(hostname: string): boolean {
  return apexOf(hostname) === hostname
}

/**
 * The www twin Shopify offers to connect alongside: `brand.in` ⇄ `www.brand.in`.
 * Null for other subdomains, which have no natural twin.
 */
export function wwwCounterpart(hostname: string): string | null {
  if (isApex(hostname)) return `www.${hostname}`
  if (hostname.startsWith('www.') && isApex(hostname.slice(4))) return hostname.slice(4)
  return null
}

/**
 * True when `hostname` is, or sits under, one of the platform's own domains
 * (the ones every store gets). Those are assigned, never connected.
 */
export function isPlatformHostname(hostname: string, platformRoots: readonly string[]): boolean {
  return platformRoots.some((root) => hostname === root || hostname.endsWith(`.${root}`))
}

/**
 * Every root a merchant may never connect as their own: the platform domains, the
 * domain new stores get addresses under (`<slug>.<PLATFORM_STORE_DOMAIN>`) and the
 * shopper login host. Without the store domain a merchant could connect
 * `somebrand.waimers.store` or `accounts.waimers.store` (audit 2026-09-28).
 */
export function platformRoots(env: {
  PLATFORM_DOMAINS: readonly string[]
  PLATFORM_STORE_DOMAIN: string
  ACCOUNTS_URL?: string | undefined
}): string[] {
  const roots = [...env.PLATFORM_DOMAINS, env.PLATFORM_STORE_DOMAIN]
  if (env.ACCOUNTS_URL) {
    try {
      roots.push(new URL(env.ACCOUNTS_URL).hostname)
    } catch {
      // A malformed ACCOUNTS_URL is refused at env load; nothing to add.
    }
  }
  return [...new Set(roots.map((r) => r.trim().toLowerCase()).filter(Boolean))]
}
