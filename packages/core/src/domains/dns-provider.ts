/** SOURCE OF TRUTH: dns domain provider, DOMAIN_PROVIDER=dns — WHAT: real DNS lookups + TLS handshake decide when a custom domain goes live / WHY: the dev provider leaves real domains pending forever */
import * as dns from 'node:dns/promises'
import * as tls from 'node:tls'
import type { DomainCheck, DomainCheckInput, DomainProvider } from './provider'
import { VERIFY_LABEL } from './records'

/** The three lookups the provider needs; `node:dns/promises` in production, a fake in tests. */
export type DnsResolver = {
  resolve4(hostname: string): Promise<string[]>
  resolveCname(hostname: string): Promise<string[]>
  resolveTxt(hostname: string): Promise<string[][]>
}

/** True when `hostname:443` presents a certificate the system trusts for that name. */
export type TlsChecker = (hostname: string) => Promise<boolean>

const LOOKUP_TIMEOUT_MS = 5_000
const TLS_TIMEOUT_MS = 5_000

/**
 * Cloudflare's published IPv4 ranges (cloudflare.com/ips-v4). A domain proxied
 * through Cloudflare (orange cloud) resolves to these instead of our server, so
 * its routing record cannot be seen; the TXT record proves it instead.
 */
const CLOUDFLARE_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
]

/** DNS answers meaning "no such record" rather than "could not ask". */
const NOT_FOUND = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN', 'NOTFOUND', 'NODATA'])

function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null
  }
  return parts.reduce((n, p) => n * 256 + p, 0)
}

function inRange(ip: string, cidr: string): boolean {
  const [base = '', bits = '32'] = cidr.split('/')
  const a = ipToInt(ip)
  const b = ipToInt(base)
  if (a === null || b === null) return false
  const size = 2 ** (32 - Number(bits))
  return Math.floor(a / size) === Math.floor(b / size)
}

const isCloudflare = (ip: string) => CLOUDFLARE_V4.some((cidr) => inRange(ip, cidr))

const normHost = (h: string) => h.trim().toLowerCase().replace(/\.$/, '')

const normTxt = (v: string) => v.trim().replace(/^"|"$/g, '')

function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code.replace(/^DNS_/, '').toUpperCase() : ''
}

/**
 * One lookup with a hard time limit. Returns what was found ([] for "no such
 * record"), or null when the question could not be answered (timeout, server
 * failure), which the caller treats as "try again later".
 */
async function lookup<T>(fn: () => Promise<T[]>, timeoutMs: number): Promise<T[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })
  try {
    return await Promise.race([
      fn().catch((err: unknown) => (NOT_FOUND.has(errorCode(err)) ? [] : null)),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** TLS handshake against hostname:443 that never throws; false on any failure or after the timeout. */
function tlsHandshake(hostname: string, timeoutMs = TLS_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: true,
    })
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      resolve(ok)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    socket.once('secureConnect', () => finish(socket.authorized))
    socket.once('error', () => finish(false))
  })
}

const list = (values: string[]) =>
  values.length <= 1 ? (values[0] ?? '') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`

/**
 * Real provider: asks DNS whether the merchant's records are in place and,
 * once they are, whether the storefront already serves a trusted certificate.
 *
 * - Apex: an A record must include the server's address.
 * - Subdomain: a CNAME to the platform's target, or (flattened CNAMEs,
 *   Cloudflare DNS-only) an A record with the server's address.
 * - Cloudflare-proxied (orange cloud): addresses are Cloudflare's, so routing
 *   counts as correct only when the TXT record proves ownership.
 * - The TXT record `_waimers-verify[.name]` must carry the token.
 *
 * Missing records keep the domain `pending`; records pointing elsewhere make it
 * `misconfigured`. A lookup that times out or fails returns the previous state.
 */
export function createDnsDomainProvider(
  opts: {
    resolver?: DnsResolver | undefined
    tlsCheck?: TlsChecker | undefined
    lookupTimeoutMs?: number | undefined
  } = {},
): DomainProvider {
  const resolver = opts.resolver ?? dns
  const tlsCheck = opts.tlsCheck ?? ((h: string) => tlsHandshake(h))
  const timeoutMs = opts.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS

  return {
    id: 'dns',
    async check(input: DomainCheckInput): Promise<DomainCheck> {
      const host = normHost(input.hostname)
      const routing = input.expected.find((r) => r.purpose === 'routing')
      const txt = input.expected.find((r) => r.purpose === 'verification')
      const isCname = routing?.type === 'CNAME'

      const [a, cname, txtRaw] = await Promise.all([
        lookup(() => resolver.resolve4(host), timeoutMs),
        isCname ? lookup(() => resolver.resolveCname(host), timeoutMs) : Promise.resolve([]),
        txt
          ? lookup(() => resolver.resolveTxt(`${VERIFY_LABEL}.${host}`), timeoutMs)
          : Promise.resolve([] as string[][]),
      ])

      if (a === null || cname === null || txtRaw === null) {
        return {
          dns: input.previous?.dns ?? 'pending',
          ssl: input.previous?.ssl ?? 'pending',
          observed: [],
          error: `We could not look up ${host} just now. We will try again in a few minutes.`,
        }
      }

      const name = routing?.name ?? '@'
      const txtValues = txtRaw.map((chunks) => normTxt(chunks.join('')))
      const observed: DomainCheck['observed'] = [
        ...cname.map((value) => ({ type: 'CNAME' as const, name, value: normHost(value) })),
        ...a.map((value) => ({ type: 'A' as const, name, value })),
        ...(txt ? txtValues.map((value) => ({ type: 'TXT' as const, name: txt.name, value })) : []),
      ]

      const txtOk = !txt || txtValues.includes(normTxt(txt.value))
      const txtWrong = !!txt && !txtOk && txtValues.length > 0

      const serverIp = input.targets.aRecord
      const pointsHere = isCname
        ? cname.some((c) => normHost(c) === normHost(routing?.value ?? '')) || a.includes(serverIp)
        : a.includes(routing?.value ?? serverIp)
      const proxied = !pointsHere && a.length > 0 && a.every(isCloudflare)
      const pointsElsewhere = !pointsHere && !proxied && (a.length > 0 || cname.length > 0)

      const routingOk = pointsHere || (proxied && !!txt && txtOk)
      const problems: string[] = []
      if (pointsElsewhere && routing) {
        const found = cname.length > 0 ? normHost(cname[0] ?? '') : list(a)
        problems.push(
          isCname
            ? `${host} points at ${found}. Change it to a CNAME record with the value ${routing.value}.`
            : `${host} points at ${found}. Change the A record to ${routing.value}.`,
        )
      }
      if (txtWrong && txt) {
        problems.push(
          `The TXT record ${txt.name} has a different value. Change it to ${txt.value}.`,
        )
      }

      if (problems.length > 0) {
        return { dns: 'misconfigured', ssl: 'pending', observed, error: problems.join(' ') }
      }

      if (!routingOk || !txtOk) {
        const missing: string[] = []
        if (proxied) {
          missing.push(
            txt
              ? `${host} goes through Cloudflare's proxy, so we cannot see where it points. Add the TXT record ${txt.name} so we can confirm it is yours.`
              : `${host} goes through Cloudflare's proxy, so we cannot see where it points. Turn the proxy off (DNS only) while we connect it.`,
          )
        } else {
          if (!routingOk && routing) {
            missing.push(`We have not found the ${routing.type} record for ${host} yet.`)
          }
          if (!txtOk && txt) missing.push(`We have not found the TXT record ${txt.name} yet.`)
        }
        return { dns: 'pending', ssl: 'pending', observed, error: missing.join(' ') }
      }

      const secure = await tlsCheck(host).catch(() => false)
      return {
        dns: 'verified',
        ssl: secure ? 'active' : 'issuing',
        observed,
        error: proxied
          ? `${host} goes through Cloudflare's proxy, so we confirmed it with your TXT record.`
          : null,
      }
    },
  }
}
