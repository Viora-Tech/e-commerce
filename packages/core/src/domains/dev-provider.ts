import type { DomainCheck, DomainCheckInput, DomainProvider } from './provider'

/** How long the dev provider pretends a certificate takes after DNS verifies. */
export const DEV_SSL_ISSUE_MS = 60_000

/** Reserved suffixes (RFC 2606/6761) the dev provider treats as correctly pointed. */
const VERIFIES = ['.test', '.example']
/** Documentation address (RFC 5737) the dev provider reports for a wrong record. */
const WRONG_IP = '203.0.113.9'

/**
 * Deterministic provider for development and tests; never resolves DNS.
 *
 * - `*.test` and `*.example` verify on the first check; the certificate is
 *   `issuing` for a minute after that, then `active`.
 * - a first label starting with `fail` (`fail.brand.test`) is misconfigured:
 *   its routing record points somewhere else.
 * - everything else (a real domain) stays `pending`, as it would until the
 *   records are added.
 */
export function createDevDomainProvider(opts: { sslIssueMs?: number } = {}): DomainProvider {
  const sslIssueMs = opts.sslIssueMs ?? DEV_SSL_ISSUE_MS
  return {
    id: 'dev',
    async check(input: DomainCheckInput): Promise<DomainCheck> {
      const routing = input.expected.find((r) => r.purpose === 'routing')
      const first = input.hostname.split('.')[0] ?? ''
      if (first.startsWith('fail')) {
        const observed = routing
          ? [{ type: 'A' as const, name: routing.name, value: WRONG_IP }]
          : []
        return {
          dns: 'misconfigured',
          ssl: 'pending',
          observed,
          error: routing
            ? `${routing.name} points at ${WRONG_IP}. Change it to a ${routing.type} record with the value ${routing.value}.`
            : 'The domain points somewhere else.',
        }
      }
      if (!VERIFIES.some((s) => input.hostname.endsWith(s))) {
        return { dns: 'pending', ssl: 'pending', observed: [], error: null }
      }
      const since = input.verifiedAt ?? input.now
      const issued = input.now.getTime() - since.getTime() >= sslIssueMs
      return {
        dns: 'verified',
        ssl: issued ? 'active' : 'issuing',
        observed: input.expected.map(({ type, name, value }) => ({ type, name, value })),
        error: null,
      }
    },
  }
}
