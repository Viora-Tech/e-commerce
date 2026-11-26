/**
 * The affiliate portal's own address (Affiliates app, Settings › Portal address). The portal
 * answers on `affiliate.<store domain>` once that host is connected like any other custom
 * domain; until then it lives at `/affiliate` on every store domain. Pure and browser-safe: the
 * admin card and the API both read the same rules. The storefront's matching side is
 * `apps/storefront/src/lib/portal-routing.ts` (`portalHostFor`, `portalStoreHosts`).
 */

/** The subdomain the portal answers on. */
export const PORTAL_SUBDOMAIN = 'affiliate'
/** The portal's path on the store's own domains. */
export const PORTAL_PATH = '/affiliate'

type DomainLike = { hostname: string; kind: string; isPrimary: boolean }

/** The store's primary domain when it is its own (custom), else null. */
export function primaryCustomDomain<T extends DomainLike>(domains: readonly T[]): T | null {
  const primary = domains.find((d) => d.isPrimary)
  return primary && primary.kind === 'custom' ? primary : null
}

/** `www.waimers.in` and `waimers.in` → `affiliate.waimers.in`; `shop.brand.in` → `affiliate.shop.brand.in`. */
export function portalHostnameFor(hostname: string): string {
  const base = hostname.startsWith('www.') ? hostname.slice(4) : hostname
  return `${PORTAL_SUBDOMAIN}.${base}`
}

/** The portal host to connect for this store: `affiliate.<primary custom domain>`, or null without one. */
export function portalHostname(domains: readonly DomainLike[]): string | null {
  const primary = primaryCustomDomain(domains)
  return primary ? portalHostnameFor(primary.hostname) : null
}

/** The address that always works: `https://<primary domain>/affiliate`. Null with no domains at all. */
export function portalFallbackUrl(domains: readonly DomainLike[]): string | null {
  const primary = domains.find((d) => d.isPrimary) ?? domains[0]
  return primary ? `https://${primary.hostname}${PORTAL_PATH}` : null
}

/** The store's row for its portal host, when it was connected. */
export function findPortalDomain<T extends DomainLike>(domains: readonly T[]): T | null {
  const hostname = portalHostname(domains)
  return hostname ? (domains.find((d) => d.hostname === hostname) ?? null) : null
}
