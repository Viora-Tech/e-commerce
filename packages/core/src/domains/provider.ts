import type { DnsRecord, DomainTargets } from './records'

export type DnsState = 'pending' | 'verified' | 'misconfigured'
export type SslState = 'pending' | 'issuing' | 'active' | 'failed'

export type DomainCheckInput = {
  hostname: string
  verificationToken: string | null
  /** Records the merchant was asked to add. */
  expected: DnsRecord[]
  /** Where the platform's records point; a subdomain may use an A record to `aRecord` instead of the CNAME. */
  targets: DomainTargets
  /** The last recorded answer, returned as-is when a lookup times out. */
  previous?:
    | { dns: DnsState; ssl: SslState; edgeRecords?: DnsRecord[] | null | undefined }
    | undefined
  /** The proxy has this hostname's route. An edge provider needs it before calling a domain secure. */
  routeReady?: boolean | undefined
  /** When DNS was first seen correct; providers use it to age certificate issuance. */
  verifiedAt: Date | null
  now: Date
}

export type DomainCheck = {
  dns: DnsState
  ssl: SslState
  /** What the provider actually found, shown beside the expected records. */
  observed: Omit<DnsRecord, 'purpose'>[]
  /** Something the merchant can act on, or null. */
  error: string | null
  /** Extra records an edge provider wants added; stored on the row and shown with the rest. */
  edgeRecords?: DnsRecord[] | null | undefined
}

/**
 * Checks that a hostname points at the platform and that a certificate exists
 * for it. `cloudflare` (cloudflare-provider.ts) sits on the edge provider's
 * custom hostname API; `dns` (dns-provider.ts) asks DNS and does a TLS
 * handshake; `dev` decides from the hostname alone and never touches the
 * network. Must not throw for DNS or API problems: those come back as state.
 */
export type DomainProvider = {
  readonly id: string
  check(input: DomainCheckInput): Promise<DomainCheck>
}
