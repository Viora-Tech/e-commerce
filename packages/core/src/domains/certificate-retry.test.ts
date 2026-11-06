/** SOURCE OF TRUTH: certificate retry tests — WHAT: check outcomes, backoff, re-register, merchant retry through a fake Dokploy, TLS check and DNS / WHY: tests never touch a real proxy or network */
import { createDb, outboxEvent, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { CERT_REASON, type CertState } from './certificate'
import {
  type CertificateDeps,
  checkCertificate,
  RETRY_REQUEST_GAP_MS,
  requestCertificateRetry,
  runCertificateSweep,
} from './certificate-retry'
import type { DokployClient, DokployDomain } from './dokploy'
import { domainView } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const SERVER_IP = '203.0.113.7'
const targets = { aRecord: SERVER_IP, cnameTarget: 'shops.waimers.localhost' }
const guard = {
  platformRoots: ['localhost'],
  cnameTarget: targets.cnameTarget,
  storeDomain: 'koomerce.app',
}
const MIN = 60_000
const t0 = new Date('2026-10-11T10:00:00Z')
const ago = (ms: number) => new Date(t0.getTime() - ms)

function fakeDokploy(initial: DokployDomain[] = []) {
  const domains = [...initial]
  const calls: string[] = []
  let next = 1
  const client: DokployClient = {
    async listDomains() {
      return [...domains]
    },
    async createDomain(host) {
      calls.push(`create ${host}`)
      const d = { domainId: `d${next++}`, host }
      domains.push(d)
      return d
    },
    async deleteDomain(domainId) {
      calls.push(`delete ${domainId}`)
      const i = domains.findIndex((d) => d.domainId === domainId)
      if (i >= 0) domains.splice(i, 1)
    },
  }
  return { client, domains, calls }
}

/** Per-host TLS state and DNS answers, mutable so a test can "fix DNS" or "issue the cert". */
function world(
  tls: Record<string, CertState> = {},
  dnsA: Record<string, string[]> = {},
  d = fakeDokploy(),
) {
  const deps = (extra: Partial<CertificateDeps> = {}): CertificateDeps => ({
    db: app,
    client: d.client,
    guard,
    targets,
    tlsCheck: async (host) => tls[host] ?? 'default',
    resolver: {
      resolve4: async (host) => {
        const a = dnsA[host]
        if (!a) throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' })
        return a
      },
    },
    settleMs: 0,
    sleep: async () => undefined,
    now: t0,
    ...extra,
  })
  return { tls, dnsA, d, deps }
}

async function seed(hostname: string, over: Partial<typeof storeDomain.$inferInsert> = {}) {
  const [s] = await owner
    .insert(store)
    .values({ slug: hostname.split('.')[0] as string, name: hostname })
    .returning()
  if (!s) throw new Error('seed')
  const [row] = await owner
    .insert(storeDomain)
    .values({
      storeId: s.id,
      hostname,
      kind: 'platform',
      status: 'active',
      sslStatus: 'issuing',
      routeStatus: 'ready',
      sslStartedAt: ago(10 * MIN),
      ...over,
    })
    .returning()
  if (!row) throw new Error('seed row')
  return row
}

const reload = async (id: string) => {
  const [row] = await owner.select().from(storeDomain).where(eq(storeDomain.id, id))
  return row as typeof storeDomain.$inferSelect
}

describe('checkCertificate', () => {
  it('marks a host with a trusted certificate active and clears the error', async () => {
    const row = await seed('asha.koomerce.app', { sslStatus: 'failed', error: CERT_REASON.dns })
    const w = world({ 'asha.koomerce.app': 'valid' })
    expect(await checkCertificate(w.deps(), row)).toBe('active')
    expect(await reload(row.id)).toMatchObject({ sslStatus: 'active', error: null })
    expect(w.d.calls).toEqual([])
  })

  it('fails with "DNS not pointing here yet" when the name does not resolve to us', async () => {
    const row = await seed('asha.koomerce.app')
    const w = world({}, {})
    expect(await checkCertificate(w.deps(), row)).toBe('dns')
    expect(await reload(row.id)).toMatchObject({ sslStatus: 'failed', error: CERT_REASON.dns })
    expect(w.d.calls).toEqual([])
  })

  it('also fails on DNS when it points at some other server', async () => {
    const row = await seed('asha.koomerce.app')
    const w = world({}, { 'asha.koomerce.app': ['198.51.100.9'] })
    expect(await checkCertificate(w.deps(), row)).toBe('dns')
  })

  it('treats Cloudflare-proxied addresses as pointing here', async () => {
    const row = await seed('asha.koomerce.app', { routeRequestedAt: ago(60 * MIN) })
    const w = world({}, { 'asha.koomerce.app': ['104.16.1.1'] })
    expect(await checkCertificate(w.deps(), row)).toBe('reregistered')
  })

  it('shows "getting the certificate", not a failure, in the first minutes', async () => {
    const row = await seed('asha.koomerce.app', { sslStartedAt: ago(2 * MIN) })
    const w = world({}, { 'asha.koomerce.app': [SERVER_IP] })
    expect(await checkCertificate(w.deps(), row)).toBe('issuing')
    expect(await reload(row.id)).toMatchObject({ sslStatus: 'issuing', error: null })
    expect(w.d.calls).toEqual([])
  })

  it('re-registers (delete + create) when DNS is right but Traefik still serves its default certificate', async () => {
    const row = await seed('asha.koomerce.app', { sslStartedAt: ago(10 * MIN) })
    const d = fakeDokploy([{ domainId: 'old', host: 'asha.koomerce.app' }])
    const w = world({}, { 'asha.koomerce.app': [SERVER_IP] }, d)
    expect(await checkCertificate(w.deps(), row)).toBe('reregistered')
    expect(d.calls).toEqual(['delete old', 'create asha.koomerce.app'])
    const after = await reload(row.id)
    expect(after).toMatchObject({ sslStatus: 'issuing', routeStatus: 'ready' })
    expect(after.routeRequestedAt).toEqual(t0)
  })

  it('does not re-register again within ten minutes of the last time', async () => {
    const row = await seed('asha.koomerce.app', { routeRequestedAt: ago(3 * MIN) })
    const w = world({}, { 'asha.koomerce.app': [SERVER_IP] })
    expect(await checkCertificate(w.deps(), row)).toBe('certificate')
    expect(w.d.calls).toEqual([])
    expect(await reload(row.id)).toMatchObject({
      sslStatus: 'failed',
      error: CERT_REASON.certificate,
    })
  })

  it('without Dokploy keys it still records the reason', async () => {
    const row = await seed('asha.koomerce.app')
    const w = world({}, { 'asha.koomerce.app': [SERVER_IP] })
    expect(await checkCertificate(w.deps({ client: null }), row)).toBe('certificate')
  })

  it('leaves a live host alone when it simply cannot be reached right now', async () => {
    const row = await seed('asha.koomerce.app', { sslStatus: 'active', sslStartedAt: null })
    const w = world({ 'asha.koomerce.app': 'unreachable' }, { 'asha.koomerce.app': [SERVER_IP] })
    expect(await checkCertificate(w.deps(), row)).toBe('unchanged')
    expect((await reload(row.id)).sslStatus).toBe('active')
  })

  it('catches an "active" row that is really serving the default certificate', async () => {
    const row = await seed('asha.koomerce.app', { sslStatus: 'active', sslStartedAt: null })
    const w = world({ 'asha.koomerce.app': 'default' }, { 'asha.koomerce.app': [SERVER_IP] })
    expect(await checkCertificate(w.deps(), row)).toBe('issuing')
    expect((await reload(row.id)).sslStartedAt).toEqual(t0)
  })

  it('skips a hostname the route guard refuses', async () => {
    const row = await seed('a.b.koomerce.app')
    const w = world()
    expect(await checkCertificate(w.deps(), row)).toBe('skipped')
  })

  it('checks custom domains the same way', async () => {
    const row = await seed('brand.in', { kind: 'custom' })
    const w = world({}, { 'brand.in': [SERVER_IP] })
    expect(await checkCertificate(w.deps(), row)).toBe('reregistered')
  })
})

describe('runCertificateSweep', () => {
  it('re-registers a stuck host, then re-checks it once the certificate is issued', async () => {
    const row = await seed('asha.koomerce.app')
    const w = world({}, { 'asha.koomerce.app': [SERVER_IP] })
    const deps = w.deps({
      sleep: async () => {
        w.tls['asha.koomerce.app'] = 'valid' // Traefik got its certificate during the pause
      },
    })
    const r = await runCertificateSweep(deps)
    expect(r).toMatchObject({ checked: 1, reregistered: 1, failed: 0 })
    expect(w.d.calls).toEqual(['create asha.koomerce.app'])
    expect(await reload(row.id)).toMatchObject({ sslStatus: 'active', error: null })
  })

  it('only looks at hosts that are due on their backoff', async () => {
    await seed('asha.koomerce.app', { sslCheckedAt: ago(2 * MIN) })
    const w = world({}, { 'asha.koomerce.app': [SERVER_IP] })
    expect((await runCertificateSweep(w.deps())).checked).toBe(0)
  })

  it('gives up after three days', async () => {
    await seed('old.koomerce.app', { sslStatus: 'failed', sslStartedAt: ago(4 * 24 * 60 * MIN) })
    const w = world({}, { 'old.koomerce.app': [SERVER_IP] })
    expect((await runCertificateSweep(w.deps())).checked).toBe(0)
  })

  it('carries on past one broken row', async () => {
    await seed('asha.koomerce.app')
    const w = world({}, { 'asha.koomerce.app': [SERVER_IP] })
    w.d.client.createDomain = async () => {
      throw new Error('Dokploy domain.create answered 502')
    }
    const r = await runCertificateSweep(w.deps())
    expect(r).toMatchObject({ checked: 0, failed: 1 })
  })
})

describe('requestCertificateRetry', () => {
  const asStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
    withStore(app, storeId, fn)

  it('restarts the wait, clears the error and queues a re-register job', async () => {
    const row = await seed('asha.koomerce.app', { sslStatus: 'failed', error: CERT_REASON.dns })
    const out = await asStore(row.storeId, (tx) =>
      requestCertificateRetry(tx, row.storeId, row.id, t0),
    )
    expect(out).toMatchObject({ sslStatus: 'issuing', error: null })
    expect((await reload(row.id)).sslStartedAt).toEqual(t0)
    const events = await owner.select().from(outboxEvent)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'domain.route_requested',
      payload: { domainId: row.id, reregister: true },
    })
    // The route stays ready: the sweep keeps watching the host.
    expect((await reload(row.id)).routeStatus).toBe('ready')
  })

  it('allows one retry per two minutes', async () => {
    const row = await seed('asha.koomerce.app', {
      sslStatus: 'failed',
      error: CERT_REASON.certificate,
      routeRequestedAt: ago(RETRY_REQUEST_GAP_MS - 1),
    })
    await expect(
      asStore(row.storeId, (tx) => requestCertificateRetry(tx, row.storeId, row.id, t0)),
    ).rejects.toThrow(/just started/)
    await expect(
      asStore(row.storeId, (tx) =>
        requestCertificateRetry(tx, row.storeId, row.id, new Date(t0.getTime() + 2 * MIN)),
      ),
    ).resolves.toMatchObject({ sslStatus: 'issuing' })
  })

  it('refuses an active certificate and a domain whose DNS is not verified', async () => {
    const active = await seed('asha.koomerce.app', { sslStatus: 'active' })
    await expect(
      asStore(active.storeId, (tx) => requestCertificateRetry(tx, active.storeId, active.id, t0)),
    ).rejects.toThrow(/already has an active/)
    const pending = await seed('brand.in', { kind: 'custom', status: 'pending' })
    await expect(
      asStore(pending.storeId, (tx) =>
        requestCertificateRetry(tx, pending.storeId, pending.id, t0),
      ),
    ).rejects.toThrow(/Finish connecting/)
  })
})

describe('domainView', () => {
  it('says why the certificate failed, only when it did', async () => {
    const failedDns = await seed('a1.koomerce.app', { sslStatus: 'failed', error: CERT_REASON.dns })
    const failedCert = await seed('a2.koomerce.app', {
      sslStatus: 'failed',
      error: CERT_REASON.certificate,
    })
    const fine = await seed('a3.koomerce.app', { sslStatus: 'active' })
    expect(domainView(failedDns, targets).sslReason).toBe('dns')
    expect(domainView(failedCert, targets).sslReason).toBe('certificate')
    expect(domainView(fine, targets).sslReason).toBeNull()
  })
})

describe('rows Cloudflare took on', () => {
  it('a passing handshake never turns the certificate active', async () => {
    const row = await seed('www.brand.in', {
      kind: 'custom',
      status: 'active',
      sslStatus: 'issuing',
      routeStatus: 'ready',
      edgeRecords: [],
    })
    const w = world({ 'www.brand.in': 'valid' })
    expect(await checkCertificate(w.deps(), row)).toBe('skipped')
    const [after] = await owner.select().from(storeDomain).where(eq(storeDomain.id, row.id))
    expect(after?.sslStatus).toBe('issuing')
    expect(w.d.calls).toEqual([])
  })

  it('a pre-existing row with no edge records is checked as before', async () => {
    const row = await seed('www.brand.in', {
      kind: 'custom',
      status: 'active',
      sslStatus: 'issuing',
      routeStatus: 'ready',
    })
    expect(await checkCertificate(world({ 'www.brand.in': 'valid' }).deps(), row)).toBe('active')
  })

  it('the sweep keeps the apex redirect when it re-registers a route', async () => {
    const row = await seed('brand.in', {
      kind: 'custom',
      status: 'active',
      sslStatus: 'issuing',
      routeStatus: 'ready',
      sslStartedAt: ago(10 * MIN),
    })
    const d = fakeDokploy()
    d.client.apexMiddleware = 'apex-to-www@file'
    const created: unknown[] = []
    const create = d.client.createDomain
    d.client.createDomain = (host, opts) => {
      created.push(opts)
      return create(host, opts)
    }
    const w = world({}, { 'brand.in': [SERVER_IP] }, d)
    expect(await checkCertificate(w.deps(), row)).toBe('reregistered')
    expect(created).toEqual([{ middlewares: ['apex-to-www@file'] }])
  })

  it('the merchant button points at Verify connection instead', async () => {
    const row = await seed('www.brand.in', {
      kind: 'custom',
      status: 'active',
      sslStatus: 'issuing',
      edgeRecords: [],
    })
    await expect(
      withStore(app, row.storeId, (tx) => requestCertificateRetry(tx, row.storeId, row.id, t0)),
    ).rejects.toThrow('Press Verify connection')
  })
})
