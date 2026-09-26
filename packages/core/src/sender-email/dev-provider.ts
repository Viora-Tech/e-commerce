/** SOURCE OF TRUTH: offline sender identity provider — WHAT: fake SES domain identities for dev and tests / WHY: the Sender email card works with no AWS account and never touches the network */
import { createHash } from 'node:crypto'
import type { SenderIdentityProvider, SenderIdentityState } from '@commerce/notifications-ses'

/**
 * Decides from the domain alone, like the dev domain provider:
 * `*.test`, `*.example` and `*.localhost` verify on the first check,
 * `fail.*` fails, everything else stays pending. Tokens are a hash of the
 * domain, so the records a developer sees are stable.
 */
export function createDevSenderIdentityProvider(): SenderIdentityProvider {
  const known = new Map<string, { mailFrom: string | null; checks: number }>()

  const tokensFor = (domain: string) =>
    [0, 1, 2].map((i) => createHash('sha256').update(`${domain}:${i}`).digest('hex').slice(0, 32))

  const outcome = (domain: string): SenderIdentityState['status'] => {
    if (domain.startsWith('fail.')) return 'failed'
    if (/\.(test|example|localhost)$/.test(domain)) return 'verified'
    return 'pending'
  }

  const stateOf = (domain: string): SenderIdentityState => {
    const entry = known.get(domain)
    // Freshly created identities are pending until the first check, as in SES.
    const status = entry && entry.checks > 0 ? outcome(domain) : 'pending'
    return {
      status,
      dkimTokens: tokensFor(domain),
      dkimHostedZone: 'dkim.amazonses.com',
      mailFrom: entry?.mailFrom ? { domain: entry.mailFrom, status } : null,
      error: status === 'failed' ? 'records_not_found' : null,
    }
  }

  return {
    id: 'dev',
    region: 'ap-south-1',
    async create(domain, opts) {
      known.set(domain, { mailFrom: opts.mailFromDomain, checks: 0 })
      return stateOf(domain)
    },
    async get(domain) {
      // A process restart forgets identities; treat any domain as known so the card keeps working.
      const entry = known.get(domain) ?? { mailFrom: `bounce.${domain}`, checks: 0 }
      known.set(domain, { ...entry, checks: entry.checks + 1 })
      return stateOf(domain)
    },
    async setMailFrom(domain, mailFromDomain) {
      const entry = known.get(domain)
      if (entry) entry.mailFrom = mailFromDomain
      return true
    },
    async remove(domain) {
      known.delete(domain)
    },
  }
}
