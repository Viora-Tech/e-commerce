/** SOURCE OF TRUTH: store-address certificate checks — WHAT: TLS and DNS probes, the retry schedule and the reasons shown to merchants / WHY: Let's Encrypt fails once when DNS is late and Traefik never retries on its own, so the browser keeps Traefik's default certificate */

/*
 * A host with no usable certificate is served Traefik's self-signed "TRAEFIK DEFAULT CERT". So the
 * check opens a TLS connection without rejecting untrusted certificates, then looks at what it was
 * given: the default certificate, a chain the system does not trust, a name mismatch, or nothing.
 * Only a certificate trusted for that exact host counts as active.
 */
import * as tls from 'node:tls'
import { type DnsResolver, isCloudflare, lookup } from './dns-provider'
import type { DomainTargets } from './records'

/** The two reasons a merchant sees; `error` on the row holds exactly these strings. */
export const CERT_REASON = {
  dns: 'DNS not pointing here yet',
  certificate: 'Certificate pending',
} as const

/** `dns`: waiting for the address to point at us. `certificate`: DNS is fine, the certificate is not issued. */
export type CertReason = 'dns' | 'certificate'

export const reasonOf = (error: string | null): CertReason =>
  error === CERT_REASON.dns ? 'dns' : 'certificate'

export type CertState = 'valid' | 'default' | 'untrusted' | 'unreachable'

/** What the host presents on port 443; never throws. */
export type CertChecker = (hostname: string) => Promise<CertState>

const TLS_TIMEOUT_MS = 5_000
const LOOKUP_TIMEOUT_MS = 5_000

export function tlsCertState(hostname: string, timeoutMs = TLS_TIMEOUT_MS): Promise<CertState> {
  return new Promise((resolve) => {
    let settled = false
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false,
    })
    const finish = (state: CertState) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(state)
    }
    const timer = setTimeout(() => finish('unreachable'), timeoutMs)
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      const names = JSON.stringify([cert.subject, cert.issuer]).toLowerCase()
      if (names.includes('traefik default cert')) return finish('default')
      finish(socket.authorized ? 'valid' : 'untrusted')
    })
    socket.once('error', () => finish('unreachable'))
  })
}

/** True when the host's A records are our server or Cloudflare's (proxied); null when DNS could not be asked. */
export async function dnsPointsHere(
  hostname: string,
  targets: DomainTargets,
  resolver: Pick<DnsResolver, 'resolve4'>,
  timeoutMs = LOOKUP_TIMEOUT_MS,
): Promise<boolean | null> {
  const a = await lookup(() => resolver.resolve4(hostname), timeoutMs)
  if (a === null) return null
  return a.some((ip) => ip === targets.aRecord || isCloudflare(ip))
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** Past this the sweep stops; "Retry certificate" still works. */
export const CERT_RETRY_WINDOW_MS = 3 * DAY

/** Within this the first issuance may simply still be running: shown as "getting", not "failed". */
export const CERT_GRACE_MS = 5 * MINUTE

/** Re-register (delete + create in Dokploy) no earlier than this into the wait, and no more often than the gap: Let's Encrypt allows 5 failed validations an hour. */
export const REREGISTER_AFTER_MS = 5 * MINUTE
export const REREGISTER_GAP_MS = 10 * MINUTE

/**
 * How long to wait between certificate checks, by how long the row has been waiting: every
 * minute at first (issuance usually takes seconds), then 5 minutes, 15 minutes, hourly, and
 * every 6 hours until `CERT_RETRY_WINDOW_MS`. Null once the window is over.
 */
function certCheckInterval(waitingMs: number): number | null {
  if (waitingMs >= CERT_RETRY_WINDOW_MS) return null
  if (waitingMs < 5 * MINUTE) return MINUTE
  if (waitingMs < 30 * MINUTE) return 5 * MINUTE
  if (waitingMs < 2 * HOUR) return 15 * MINUTE
  if (waitingMs < 6 * HOUR) return HOUR
  return 6 * HOUR
}

type CertRow = {
  sslStatus: string
  sslStartedAt: Date | null
  sslCheckedAt: Date | null
  createdAt: Date
}

/** Whether the sweep should look at this row now. Active rows are re-checked daily (renewals, a lost route). */
export function certCheckDue(row: CertRow, now: Date): boolean {
  const last = row.sslCheckedAt?.getTime() ?? null
  if (row.sslStatus === 'active') return last === null || now.getTime() - last >= DAY
  const waiting = now.getTime() - (row.sslStartedAt ?? row.createdAt).getTime()
  const every = certCheckInterval(waiting)
  if (every === null) return false
  return last === null || now.getTime() - last >= every
}
