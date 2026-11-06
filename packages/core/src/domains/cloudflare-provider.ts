/** SOURCE OF TRUTH: cloudflare domain provider, DOMAIN_PROVIDER=cloudflare — WHAT: Cloudflare's own hostname status plus real DNS decide when a subdomain goes live; an apex stays a direct, redirect-only DNS check / WHY: a TLS handshake also passes when another host serves the name, and a direct A record skips Cloudflare */

/*
 * A subdomain is `verified` only when all of these hold. Cloudflare's docs ask for the first
 * and third together: a TXT-validated hostname turns `active` before its DNS moves.
 *   - Cloudflare says the hostname is `active`
 *   - the merchant's `_waimers-verify` TXT is there (it ties the name to this store, so a
 *     CNAME left behind by a store that moved away cannot be picked up by another)
 *   - DNS reaches Cloudflare through our CNAME target, never a direct A record
 * The certificate is `active` only when Cloudflare says so and Traefik has the route the
 * tunnel needs (`routeReady`). Nothing here looks at a padlock.
 *
 * A hostname is created only once that TXT is there. Each one is billed past the included 100,
 * and a pending row is polled for good, so creating on sight would let any merchant run up the
 * bill with names they do not own. `edgeRecords` stays null until then: nothing at Cloudflare.
 *
 * `blocked` and friends are terminal at Cloudflare until someone asks again, so a check asks
 * again. Those rows are `failed` afterwards, which the poll skips, so only the merchant's
 * button repeats it. A failed API call or lookup returns the previous state, like `dns`.
 */
import * as dns from 'node:dns/promises'
import { CloudflareError, type CloudflareHostnames, type CustomHostname } from './cloudflare'
import {
  createDnsDomainProvider,
  type DnsResolver,
  isCloudflare,
  lookup,
  normHost,
  normTxt,
  type TlsChecker,
} from './dns-provider'
import { apexOf, isApex } from './hostname'
import type { DomainCheck, DomainCheckInput, DomainProvider } from './provider'
import { type DnsRecord, VERIFY_LABEL } from './records'

/** Stored in `error` and matched by `domainView`, so the admin can show it translated. */
export const DOMAIN_HELD_ERROR =
  'This domain is still connected to another host. Remove it from your old store or website host, wait a few minutes, then press Verify connection.'

const LOOKUP_TIMEOUT_MS = 5_000

const ACTIVE = new Set(['active', 'active_redeploying'])
const HELD = new Set(['blocked', 'pending_blocked', 'test_blocked'])
/** The certificate stopped short of active and will not move again unless asked. */
const SSL_STOPPED = new Set([
  'initializing_timed_out',
  'validation_timed_out',
  'issuance_timed_out',
  'deployment_timed_out',
  'expired',
  'inactive',
  'deleted',
])

const isHeld = (h: CustomHostname) =>
  HELD.has(h.status) || h.verificationErrors.some((e) => /\bheld zone\b/i.test(e))

/** Create the hostname. A create that loses a race with another check finds the winner's. */
async function createHostname(api: CloudflareHostnames, host: string): Promise<CustomHostname> {
  try {
    return await api.create(host)
  } catch (err) {
    if (!(err instanceof CloudflareError) || !err.refused) throw err
    const again = await api.find(host)
    if (again) return again
    throw err
  }
}

/** A name from the API (`_cf-custom-hostname.www.brand.in`) as it is typed at a registrar. */
function relativeTo(host: string, name: string): string {
  const apex = apexOf(host)
  const clean = normHost(name)
  return clean.endsWith(`.${apex}`) ? clean.slice(0, -(apex.length + 1)) : clean
}

/** The records Cloudflare still wants, for the records table; none once it has what it needs. */
function edgeRecordsFor(h: CustomHostname, host: string): DnsRecord[] {
  const wanted = [
    ...(ACTIVE.has(h.status) || !h.ownership ? [] : [h.ownership]),
    ...(h.ssl.status === 'active' ? [] : h.ssl.txt),
  ]
  return wanted.map(({ name, value }) => ({
    type: 'TXT',
    name: relativeTo(host, name),
    value,
    purpose: 'verification',
  }))
}

const caaBlocked = (h: CustomHostname) => h.ssl.validationErrors.some((e) => /\bcaa/i.test(e))

type DnsView = {
  observed: DomainCheck['observed']
  /** A CNAME to our target: the record we asked for. */
  pointsHere: boolean
  /** Only Cloudflare addresses and no CNAME: the merchant's own proxy hides the record. */
  hidden: boolean
  txtOk: boolean
  txtWrong: boolean
  /** What the name points at instead, if it does not point at us. */
  elsewhere: string | null
}

function readDns(
  input: DomainCheckInput,
  host: string,
  a: string[],
  cname: string[],
  txtRaw: string[][],
): DnsView {
  const routing = input.expected.find((r) => r.purpose === 'routing')
  const txt = input.expected.find((r) => r.purpose === 'verification')
  const name = routing?.name ?? host
  const txtValues = txtRaw.map((chunks) => normTxt(chunks.join('')))
  const cnames = cname.map(normHost)
  const pointsHere = !!routing && cnames.includes(normHost(routing.value))
  const hidden = !pointsHere && cname.length === 0 && a.length > 0 && a.every(isCloudflare)
  const txtOk = !txt || txtValues.includes(normTxt(txt.value))
  const direct = cname.length === 0 && a.length > 0 && !hidden
  return {
    observed: [
      ...cnames.map((value) => ({ type: 'CNAME' as const, name, value })),
      ...a.map((value) => ({ type: 'A' as const, name, value })),
      ...(txt ? txtValues.map((value) => ({ type: 'TXT' as const, name: txt.name, value })) : []),
    ],
    pointsHere,
    hidden,
    txtOk,
    txtWrong: !!txt && !txtOk && txtValues.length > 0,
    elsewhere: pointsHere ? null : direct ? a.join(', ') : (cnames[0] ?? null),
  }
}

/**
 * Real provider for a platform on Cloudflare for SaaS.
 *
 * - Subdomain: a custom hostname on the SaaS zone, created once the TXT proves the merchant
 *   controls the name. See the top of this file for what makes it `verified`.
 * - Apex: redirect-only, outside Cloudflare (apex proxying is Enterprise), so the `dns` rules
 *   apply, except that a proxied apex does not count: only our own address proves it reaches
 *   Traefik, where the redirect lives.
 */
export function createCloudflareDomainProvider(opts: {
  hostnames: CloudflareHostnames
  resolver?: DnsResolver | undefined
  tlsCheck?: TlsChecker | undefined
  lookupTimeoutMs?: number | undefined
  log?: ((message: string) => void) | undefined
}): DomainProvider {
  const api = opts.hostnames
  const resolver = opts.resolver ?? dns
  const timeoutMs = opts.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS
  const direct = createDnsDomainProvider({
    resolver,
    tlsCheck: opts.tlsCheck,
    lookupTimeoutMs: timeoutMs,
  })

  const logFailure = (err: unknown) =>
    opts.log?.(`[domains] ${err instanceof Error ? err.message : 'Cloudflare call failed'}`)

  const checkApex = async (input: DomainCheckInput, host: string): Promise<DomainCheck> => {
    const r = await direct.check(input)
    const reachesUs = r.observed.some((o) => o.type === 'A' && o.value === input.targets.aRecord)
    if (r.dns !== 'verified' || reachesUs) return r
    return {
      ...r,
      dns: 'pending',
      ssl: 'pending',
      error: `${host} goes through a proxy, so it cannot reach your store. Turn the proxy off (DNS only) for this record.`,
    }
  }

  const checkSubdomain = async (input: DomainCheckInput, host: string): Promise<DomainCheck> => {
    const keep = (
      error: string,
      edgeRecords: DnsRecord[] | null | undefined = input.previous?.edgeRecords,
    ): DomainCheck => ({
      dns: input.previous?.dns ?? 'pending',
      ssl: input.previous?.ssl ?? 'pending',
      observed: [],
      error,
      edgeRecords: edgeRecords ?? null,
    })
    const unreachable = `We could not check ${host} with Cloudflare just now. We will try again in a few minutes.`
    const heldCheck = (h: CustomHostname, observed: DomainCheck['observed']): DomainCheck => ({
      dns: 'misconfigured',
      ssl: 'failed',
      observed,
      error: DOMAIN_HELD_ERROR,
      edgeRecords: edgeRecordsFor(h, host),
    })

    /** The hold may be gone, and only asking again shows it. If asking fails, the status stands. */
    const released = (h: CustomHostname): Promise<CustomHostname> =>
      !isHeld(h)
        ? Promise.resolve(h)
        : api.refresh(h.id).catch((err: unknown) => {
            logFailure(err)
            return h
          })

    let hostname: CustomHostname | null
    try {
      hostname = await api.find(host)
    } catch (err) {
      logFailure(err)
      return keep(unreachable)
    }
    if (hostname) {
      hostname = await released(hostname)
      if (isHeld(hostname)) return heldCheck(hostname, [])
    }

    const txt = input.expected.find((r) => r.purpose === 'verification')
    const routing = input.expected.find((r) => r.purpose === 'routing')
    const [a, cname, txtRaw] = await Promise.all([
      lookup(() => resolver.resolve4(host), timeoutMs),
      lookup(() => resolver.resolveCname(host), timeoutMs),
      txt
        ? lookup(() => resolver.resolveTxt(`${VERIFY_LABEL}.${host}`), timeoutMs)
        : Promise.resolve([] as string[][]),
    ])
    if (a === null || cname === null || txtRaw === null) {
      return keep(
        `We could not look up ${host} just now. We will try again in a few minutes.`,
        hostname ? edgeRecordsFor(hostname, host) : undefined,
      )
    }
    const seen = readDns(input, host, a, cname, txtRaw)
    const { observed } = seen

    if (!hostname && seen.txtOk) {
      try {
        hostname = await released(await createHostname(api, host))
      } catch (err) {
        logFailure(err)
        return keep(
          err instanceof CloudflareError && err.refused
            ? `Cloudflare did not accept ${host}. If it is still connected to another host, remove it there, then press Verify connection. If that does not help, contact support.`
            : unreachable,
        )
      }
      if (isHeld(hostname)) return heldCheck(hostname, observed)
    }
    const edgeRecords = hostname
      ? edgeRecordsFor(hostname, host)
      : (input.previous?.edgeRecords ?? null)

    const problems: string[] = []
    if (seen.elsewhere && routing) {
      problems.push(
        `${host} points at ${seen.elsewhere}. Change it to a CNAME record with the value ${routing.value}.`,
      )
    }
    if (seen.txtWrong && txt) {
      problems.push(`The TXT record ${txt.name} has a different value. Change it to ${txt.value}.`)
    }
    if (problems.length > 0) {
      return {
        dns: 'misconfigured',
        ssl: 'pending',
        observed,
        error: problems.join(' '),
        edgeRecords,
      }
    }

    const missing: string[] = []
    if (!seen.pointsHere && !seen.hidden && routing) {
      missing.push(`We have not found the ${routing.type} record for ${host} yet.`)
    }
    if (!seen.txtOk && txt) missing.push(`We have not found the TXT record ${txt.name} yet.`)
    if (missing.length > 0 || !hostname) {
      return { dns: 'pending', ssl: 'pending', observed, error: missing.join(' '), edgeRecords }
    }

    // DNS is right. Cloudflare backs off between its own tries and stops at `moved` or a
    // timed-out certificate, so ask it to look now.
    let current: CustomHostname = hostname
    if (!ACTIVE.has(current.status) || SSL_STOPPED.has(current.ssl.status)) {
      try {
        current = await api.refresh(current.id)
      } catch (err) {
        logFailure(err)
        return keep(unreachable, edgeRecords)
      }
    }
    if (isHeld(current)) return heldCheck(current, observed)
    if (!ACTIVE.has(current.status)) {
      return {
        dns: 'pending',
        ssl: 'pending',
        observed,
        error: `Your records look right. We are waiting for Cloudflare to confirm ${host}. This usually takes a few minutes.`,
        edgeRecords: edgeRecordsFor(current, host),
      }
    }

    const notes: string[] = []
    if (caaBlocked(current)) {
      notes.push(
        `A CAA record on ${apexOf(host)} is stopping the free certificate. Remove it, or allow Cloudflare's certificate authorities.`,
      )
    }
    if (seen.hidden) {
      notes.push(
        `${host} goes through your own Cloudflare account, so we confirmed it with your TXT record.`,
      )
    }
    return {
      dns: 'verified',
      ssl: current.ssl.status === 'active' && input.routeReady === true ? 'active' : 'issuing',
      observed,
      error: notes.length > 0 ? notes.join(' ') : null,
      edgeRecords: edgeRecordsFor(current, host),
    }
  }

  return {
    id: 'cloudflare',
    async check(input) {
      const host = normHost(input.hostname)
      return isApex(host) ? checkApex(input, host) : checkSubdomain(input, host)
    },
  }
}
