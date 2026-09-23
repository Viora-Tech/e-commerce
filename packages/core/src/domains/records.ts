import { apexOf, isApex } from './hostname'

/** Where connected domains must point. Read from the environment by the server. */
export type DomainTargets = {
  /** IPv4 an apex domain's A record points at (apex domains cannot CNAME). */
  aRecord: string
  /** Hostname a subdomain's CNAME points at. */
  cnameTarget: string
}

export type DnsRecord = {
  type: 'A' | 'CNAME' | 'TXT'
  /** Name as the merchant types it at their registrar: `@`, `www`, `_waimers-verify.www`. */
  name: string
  value: string
  /** What the record does, for the table's help column. */
  purpose: 'routing' | 'verification'
}

/** Label under which the ownership TXT record lives. */
export const VERIFY_LABEL = '_waimers-verify'

/** The host part relative to the registrable domain: `@` for the apex, `www` for www.brand.in. */
export function relativeName(hostname: string): string {
  if (isApex(hostname)) return '@'
  return hostname.slice(0, hostname.length - apexOf(hostname).length - 1)
}

/**
 * The records a merchant adds at their registrar: one routing record (A at the
 * apex, CNAME on a subdomain) and one TXT proving they own the name.
 */
export function dnsRecordsFor(
  hostname: string,
  verificationToken: string | null,
  targets: DomainTargets,
): DnsRecord[] {
  const name = relativeName(hostname)
  const routing: DnsRecord = isApex(hostname)
    ? { type: 'A', name: '@', value: targets.aRecord, purpose: 'routing' }
    : { type: 'CNAME', name, value: targets.cnameTarget, purpose: 'routing' }
  if (!verificationToken) return [routing]
  return [
    routing,
    {
      type: 'TXT',
      name: name === '@' ? VERIFY_LABEL : `${VERIFY_LABEL}.${name}`,
      value: verificationToken,
      purpose: 'verification',
    },
  ]
}
