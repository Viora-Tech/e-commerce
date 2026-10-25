/** SOURCE OF TRUTH: sender email address rules, DNS records, From/Reply-To choice — WHAT: pure helpers the admin card and the send path share / WHY: one place decides which From a customer sees */

/** The bounce (custom MAIL FROM) subdomain: `bounce.<domain>`. Rarely taken, unlike `mail`. */
export const MAIL_FROM_SUBDOMAIN = 'bounce'

/** SES's recommended SPF value for the MAIL FROM subdomain. */
export const MAIL_FROM_SPF = 'v=spf1 include:amazonses.com ~all'

/** A starting DMARC policy: monitor only, never reject. Safe for any shop. */
export const DMARC_VALUE = 'v=DMARC1; p=none;'

export type SenderStatus = 'pending' | 'verified' | 'failed'

/**
 * Addresses nobody can prove they own by DNS. Each one would fail verification
 * after 72 hours, so the card says so up front instead.
 */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.in',
  'yahoo.co.in',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'rediffmail.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'zohomail.in',
  'gmx.com',
  'mail.com',
])

/** Second-level suffixes where the registrable domain has three labels (`waimers.co.in`). */
const TWO_PART_SUFFIXES: ReadonlySet<string> = new Set([
  'co.in',
  'net.in',
  'org.in',
  'firm.in',
  'gen.in',
  'ind.in',
  'ac.in',
  'edu.in',
  'gov.in',
  'co.uk',
  'org.uk',
  'com.au',
  'net.au',
  'co.nz',
  'com.sg',
  'com.my',
  'co.za',
  'com.br',
  'co.jp',
])

/**
 * Shared hosting suffixes: many unrelated owners sit under each, so none of
 * them (or a bare two-part suffix like `co.in`) may be claimed as a sender
 * domain. The claim also blocks parents and subdomains for every other store,
 * so claiming `co.in` would have locked every `*.co.in` shop out (audit 2026-09-28).
 */
const SHARED_SUFFIXES: ReadonlySet<string> = new Set([
  'github.io',
  'myshopify.com',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'r2.dev',
  'web.app',
  'firebaseapp.com',
  'herokuapp.com',
  'blogspot.com',
  'wixsite.com',
  'azurewebsites.net',
  'cloudfront.net',
  'amazonaws.com',
])

export type SenderAddressError = 'empty' | 'invalid' | 'free_mail' | 'platform_domain' | 'too_long'

export type ParsedSenderAddress =
  | { ok: true; email: string; local: string; domain: string }
  | { ok: false; error: SenderAddressError }

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

/** True when `a` and `b` are the same domain, or one is a subdomain of the other. */
export function domainsOverlap(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}

/**
 * Check an address the merchant typed. Lower-cased (SES matches domains
 * case-insensitively; we store one spelling). Refuses free-mail and the
 * platform's own domains, which a shop can never verify.
 */
export function parseSenderAddress(
  raw: string,
  platformDomains: readonly string[] = [],
): ParsedSenderAddress {
  const email = raw.trim().toLowerCase()
  if (!email) return { ok: false, error: 'empty' }
  if (email.length > 254) return { ok: false, error: 'too_long' }
  const at = email.lastIndexOf('@')
  if (at <= 0 || at !== email.indexOf('@')) return { ok: false, error: 'invalid' }
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64 || !LOCAL_PART.test(local)) return { ok: false, error: 'invalid' }
  const labels = domain.split('.')
  if (labels.length < 2 || domain.length > 253 || !labels.every((l) => LABEL.test(l))) {
    return { ok: false, error: 'invalid' }
  }
  // The top-level label is letters only (no "shop.123").
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1] ?? '')) return { ok: false, error: 'invalid' }
  if (FREE_MAIL_DOMAINS.has(domain)) return { ok: false, error: 'free_mail' }
  if (TWO_PART_SUFFIXES.has(domain) || SHARED_SUFFIXES.has(domain)) {
    return { ok: false, error: 'invalid' }
  }
  if (platformDomains.some((p) => p && domainsOverlap(domain, p.toLowerCase()))) {
    return { ok: false, error: 'platform_domain' }
  }
  return { ok: true, email, local, domain }
}

/** Best guess at the DNS zone a record goes in: `shop.waimers.co.in` lives in `waimers.co.in`. */
export function registrableDomain(domain: string): string {
  const labels = domain.split('.')
  const lastTwo = labels.slice(-2).join('.')
  const take = TWO_PART_SUFFIXES.has(lastTwo) ? 3 : 2
  return labels.slice(-take).join('.')
}

export type SenderDnsRecord = {
  type: 'CNAME' | 'MX' | 'TXT'
  /** Fully qualified name, e.g. `abc._domainkey.waimers.in`. */
  name: string
  /** What most providers want in their "Host" / "Name" box: the name without the zone. */
  host: string
  value: string
  /** MX only. */
  priority?: number | undefined
  /** dkim proves the domain (required); mailFrom and dmarc help delivery (recommended). */
  purpose: 'dkim' | 'mailFrom' | 'dmarc'
}

export type SenderIdentityShape = {
  domain: string
  dkimTokens: readonly string[]
  dkimHostedZone: string | null
  mailFromDomain: string | null
  /** AWS region the MAIL FROM MX points at. */
  region: string
}

function hostIn(name: string, zone: string): string {
  if (name === zone) return '@'
  return name.endsWith(`.${zone}`) ? name.slice(0, -(zone.length + 1)) : name
}

/** Every record the merchant adds at their DNS provider, required ones first. */
export function senderDnsRecords(identity: SenderIdentityShape): SenderDnsRecord[] {
  const zone = registrableDomain(identity.domain)
  const hostedZone = identity.dkimHostedZone || 'dkim.amazonses.com'
  const rec = (r: Omit<SenderDnsRecord, 'host'>): SenderDnsRecord => ({
    ...r,
    host: hostIn(r.name, zone),
  })
  const records: SenderDnsRecord[] = identity.dkimTokens.map((t) =>
    rec({
      type: 'CNAME',
      name: `${t}._domainkey.${identity.domain}`,
      value: `${t}.${hostedZone}`,
      purpose: 'dkim',
    }),
  )
  if (identity.mailFromDomain) {
    records.push(
      rec({
        type: 'MX',
        name: identity.mailFromDomain,
        value: `feedback-smtp.${identity.region}.amazonses.com`,
        priority: 10,
        purpose: 'mailFrom',
      }),
      rec({
        type: 'TXT',
        name: identity.mailFromDomain,
        value: MAIL_FROM_SPF,
        purpose: 'mailFrom',
      }),
    )
  }
  records.push(rec({ type: 'TXT', name: `_dmarc.${zone}`, value: DMARC_VALUE, purpose: 'dmarc' }))
  return records
}

export type SenderRowShape = {
  email: string
  domain: string
  displayName: string | null
  status: SenderStatus
}

export type ChosenSender = {
  fromName: string
  fromEmail: string
  /** Set while the platform address sends, so customer replies still reach the shop. */
  replyTo: string | undefined
  /** Which address customers see: the shop's own, or the platform's. */
  using: 'own' | 'platform'
}

/**
 * The From and Reply-To for a store's email. Only a verified sender whose
 * address sits on its own verified domain goes in From; anything else sends
 * from the platform's address with Reply-To set to the shop, so nothing
 * breaks while DNS is being set up.
 */
export function chooseSender(input: {
  storeName: string
  sender: SenderRowShape | null
  platform: { fromEmail: string; fromName: string }
  /** The store's contact email, the Reply-To when no sender address is set yet. */
  contactEmail?: string | null | undefined
}): ChosenSender {
  const { sender, platform } = input
  const name = sender?.displayName?.trim() || input.storeName.trim() || platform.fromName
  const onOwnDomain =
    sender !== null &&
    sender.status === 'verified' &&
    sender.email.toLowerCase().endsWith(`@${sender.domain.toLowerCase()}`)
  if (onOwnDomain) {
    return { fromName: name, fromEmail: sender.email, replyTo: undefined, using: 'own' }
  }
  return {
    fromName: name,
    fromEmail: platform.fromEmail,
    replyTo: sender?.email ?? input.contactEmail ?? undefined,
    using: 'platform',
  }
}
