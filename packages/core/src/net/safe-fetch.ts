/** SOURCE OF TRUTH: outbound fetch of untrusted URLs (SSRF guard) — WHAT a GET that only reaches public http(s) hosts, re-checks every redirect, times out and caps the bytes it reads / WHY a URL from a CSV, product HTML or a webhook body must never make our server read cloud metadata, localhost or the private network */
import { isIP } from 'node:net'
import { CommerceError } from '../errors'

/**
 * `safeFetch(url, opts)` resolves the host, refuses when ANY address it resolves to is
 * private, loopback, link-local (169.254/16 is cloud metadata), CGNAT, multicast or
 * reserved, follows at most `maxRedirects` redirects by hand (each `Location` is checked
 * the same way) and returns the final response; read its body with `readCapped`.
 *
 * Residual risk, accepted: plain `fetch` resolves the host again when it connects, so a
 * DNS answer that changes between our check and the connect (rebinding) is not caught.
 * Pinning the checked address would need a custom agent per runtime; the time window is
 * small and the redirect/scheme/literal-IP holes, which need no DNS tricks, are closed.
 */

export type LookupAll = (hostname: string) => Promise<string[]>

export type SafeFetchOptions = {
  /** Injected in tests. */
  fetch?: typeof fetch
  /** Injected in tests; defaults to `node:dns/promises` `lookup` with `all: true`. */
  lookup?: LookupAll
  /** `http:` as well as `https:` (the address checks still apply). */
  allowHttp?: boolean
  maxRedirects?: number
  timeoutMs?: number
  /** Aborts the request and its body early (the caller's own deadline), on top of `timeoutMs`. */
  signal?: AbortSignal | undefined
}

/**
 * The URL itself is refused (scheme, private address, redirect loop): asking again
 * gives the same answer, so callers that retry should not.
 */
export class BlockedUrlError extends CommerceError {
  constructor(message: string) {
    super('URL_BLOCKED', message)
  }
}

const defaultLookup: LookupAll = async (hostname) => {
  const { lookup } = await import('node:dns/promises')
  const found = await lookup(hostname, { all: true, verbatim: true })
  return found.map((a) => a.address)
}

function v4Octets(ip: string): number[] | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null
  }
  return parts
}

function isBlockedV4(ip: string): boolean {
  const o = v4Octets(ip)
  if (!o) return true
  const [a = 0, b = 0, c = 0] = o
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast 224/4, reserved 240/4, broadcast
  )
}

/** Eight 16-bit groups, or null when it does not parse. */
function v6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase()
  const zone = text.indexOf('%')
  if (zone >= 0) text = text.slice(0, zone)
  const lastColon = text.lastIndexOf(':')
  if (text.slice(lastColon + 1).includes('.')) {
    // A dotted IPv4 tail (`::ffff:127.0.0.1`) becomes its two hex groups.
    const o = v4Octets(text.slice(lastColon + 1))
    if (!o) return null
    const [a = 0, b = 0, c = 0, d = 0] = o
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const parse = (s: string) =>
    s ? s.split(':').map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? Number.parseInt(h, 16) : -1)) : []
  const head = parse(halves[0] ?? '')
  const rest = halves.length === 2 ? parse(halves[1] ?? '') : []
  const fill = 8 - head.length - rest.length
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null
  const groups = [...head, ...Array(fill).fill(0), ...rest]
  if (groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null
  return groups
}

function isBlockedV6(ip: string): boolean {
  const g = v6Groups(ip)
  if (!g) return true
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g
  const embeddedV4 = `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    // ::ffff:a.b.c.d (IPv4-mapped): judge the IPv4 address it carries.
    if (g5 === 0xffff) return isBlockedV4(embeddedV4)
    // ::, ::1 and the deprecated IPv4-compatible ::a.b.c.d.
    if (g5 === 0) return true
  }
  if (g0 === 0x64 && g1 === 0xff9b) return true // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (g0 === 0x2002) return isBlockedV4(`${g1 >> 8}.${g1 & 0xff}.${g2 >> 8}.${g2 & 0xff}`) // 6to4
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0xdb8)) return true // Teredo, documentation
  return (
    (g0 & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (g0 & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (g0 & 0xffc0) === 0xfec0 || // deprecated site-local fec0::/10
    (g0 & 0xff00) === 0xff00 // multicast ff00::/8
  )
}

/** True for any address a server-side fetch of an untrusted URL must not reach. */
function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) return isBlockedV4(ip)
  if (family === 6) return isBlockedV6(ip)
  return true
}

async function assertPublicUrl(url: URL, lookup: LookupAll, allowHttp: boolean): Promise<void> {
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw new BlockedUrlError(`${url.protocol} URLs are not allowed`)
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : await lookup(host)
  if (!addresses.length) throw new BlockedUrlError(`${host} did not resolve`)
  if (addresses.some(isBlockedAddress)) throw new BlockedUrlError(`${host} is not a public address`)
}

const REDIRECTS = new Set([301, 302, 303, 307, 308])

/** GET an untrusted URL, only ever reaching public hosts. See the file comment. */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const doFetch = opts.fetch ?? fetch
  const lookup = opts.lookup ?? defaultLookup
  const maxRedirects = opts.maxRedirects ?? 3
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 30_000)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  let url = new URL(raw)
  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url, lookup, opts.allowHttp ?? false)
    const res = await doFetch(url.href, { redirect: 'manual', signal })
    const location = res.headers.get('location')
    if (!REDIRECTS.has(res.status) || !location) return res
    await res.body?.cancel()
    if (hop >= maxRedirects) throw new BlockedUrlError('too many redirects')
    url = new URL(location, url)
  }
}

/**
 * The body, read chunk by chunk and abandoned as soon as it passes `maxBytes` (then
 * null), so a response without (or lying about) `content-length` cannot make us buffer
 * it all.
 */
export async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (Number(res.headers.get('content-length') ?? 0) > maxBytes) {
    await res.body?.cancel()
    return null
  }
  if (!res.body) return new Uint8Array()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return out
}
