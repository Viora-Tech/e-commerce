/** SOURCE OF TRUTH: custom-domain HTTPS route tests — WHAT: poll asks for routes, jobs add / skip / delete them through a fake Dokploy client, retries and env-unset skip / WHY: tests never call a real Dokploy */
import { createDb, outboxEvent, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { relayStoreOutbox } from '../outbox/relay'
import { createDevDomainProvider } from './dev-provider'
import type { DokployClient, DokployDomain } from './dokploy'
import type { DomainProvider } from './provider'
import {
  type DomainRouteJob,
  ensureRoute,
  isRoutableHostname,
  markDomainRouteFailed,
  needsRouteRequest,
  ROUTE_JOB_ATTEMPTS,
  ROUTE_RETRY_MS,
  removeRoute,
  requestDomainRoute,
  routeMiddlewares,
  runDomainRouteJob,
} from './routes'
import { connectDomain, type DomainRow, pollPendingDomains, removeDomain } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const targets = { aRecord: '192.0.2.10', cnameTarget: 'shops.waimers.localhost' }
const guard = { platformRoots: ['localhost', 'waimers.store'], cnameTarget: targets.cnameTarget }
const provider = createDevDomainProvider()
const t0 = new Date('2026-10-07T10:00:00Z')

/** In-memory Dokploy: a list of domains, and a switch to make every call fail. */
function fakeDokploy(initial: DokployDomain[] = []) {
  const domains = [...initial]
  const calls: string[] = []
  let down = false
  let next = 1
  const guardDown = () => {
    if (down) throw new Error('Dokploy domain.byApplicationId answered 502')
  }
  const client: DokployClient = {
    async listDomains() {
      calls.push('list')
      guardDown()
      return [...domains]
    },
    async createDomain(host, opts = {}) {
      calls.push(`create ${host}`)
      guardDown()
      const middlewares = opts.middlewares ?? []
      const d = { domainId: `d${next++}`, host, ...(middlewares.length ? { middlewares } : {}) }
      domains.push(d)
      return d
    },
    async deleteDomain(domainId) {
      calls.push(`delete ${domainId}`)
      guardDown()
      const i = domains.findIndex((d) => d.domainId === domainId)
      if (i >= 0) domains.splice(i, 1)
    },
  }
  return {
    client,
    domains,
    calls,
    setDown: (v: boolean) => {
      down = v
    },
  }
}

/** A store with its address; routed already unless `unrouted` (a store from before auto routes). */
async function seedStore(slug: string, opts: { unrouted?: boolean } = {}) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  await owner.insert(storeDomain).values({
    storeId: s.id,
    hostname: `${slug}.localhost`,
    isPrimary: true,
    routeStatus: opts.unrouted ? 'none' : 'ready',
  })
  return s.id
}

const connect = (storeId: string, hostname: string, extra: object = {}) =>
  withStore(app, storeId, (tx) =>
    connectDomain(
      tx,
      storeId,
      { hostname, ...extra },
      { platformRoots: guard.platformRoots, targets },
    ),
  )

const domainRow = async (id: string) => {
  const [row] = await owner.select().from(storeDomain).where(eq(storeDomain.id, id))
  return row
}

const outboxRows = () => owner.select().from(outboxEvent)

/** Relay the store's outbox into a recording route queue, as the worker would. */
async function relayRouteJobs(storeId: string): Promise<DomainRouteJob[]> {
  const jobs: DomainRouteJob[] = []
  await relayStoreOutbox(
    {
      db: app,
      plugins: { hooksFor: () => [] } as never,
      notifications: { add: async () => undefined } as never,
      domainRoutes: {
        add: async (_name, data) => {
          jobs.push(data)
        },
      },
    },
    storeId,
  )
  return jobs
}

describe('isRoutableHostname', () => {
  it('lets only normalised merchant hostnames through, never platform ones', () => {
    expect(isRoutableHostname('brand.in', guard)).toBe(true)
    expect(isRoutableHostname('www.brand.co.in', guard)).toBe(true)
    expect(isRoutableHostname('Brand.in', guard)).toBe(false)
    expect(isRoutableHostname('brand.in/x', guard)).toBe(false)
    expect(isRoutableHostname('localhost', guard)).toBe(false)
    expect(isRoutableHostname('shop.waimers.store', guard)).toBe(false)
    expect(isRoutableHostname('shops.waimers.localhost', guard)).toBe(false)
    expect(isRoutableHostname('10.0.0.1', guard)).toBe(false)
  })
})

describe('ensureRoute / removeRoute', () => {
  it('creates the domain once and finds it the second time', async () => {
    const d = fakeDokploy([{ domainId: 'x', host: 'other.in' }])
    expect(await ensureRoute(d.client, 'brand.in')).toEqual({ created: true, domainId: 'd1' })
    expect(await ensureRoute(d.client, 'brand.in')).toEqual({ created: false, domainId: 'd1' })
    expect(d.calls).toEqual(['list', 'create brand.in', 'list'])
  })

  it('treats a differently cased existing host as the same domain', async () => {
    const d = fakeDokploy([{ domainId: 'x', host: 'Brand.in.' }])
    expect(await ensureRoute(d.client, 'brand.in')).toEqual({ created: false, domainId: 'x' })
  })

  it('deletes every match and reports none when nothing is there', async () => {
    const d = fakeDokploy([
      { domainId: 'a', host: 'brand.in' },
      { domainId: 'b', host: 'brand.in' },
      { domainId: 'c', host: 'other.in' },
    ])
    expect(await removeRoute(d.client, 'brand.in')).toBe(2)
    expect(d.domains.map((x) => x.host)).toEqual(['other.in'])
    expect(await removeRoute(d.client, 'brand.in')).toBe(0)
  })
})

describe('needsRouteRequest', () => {
  const base = {
    kind: 'custom',
    status: 'active',
    sslStatus: 'issuing',
    routeStatus: 'none',
    routeRequestedAt: null,
  } as unknown as DomainRow

  it('asks for a live custom domain without a certificate, once per retry window', () => {
    expect(needsRouteRequest(base, t0)).toBe(true)
    const pending = { ...base, routeStatus: 'pending', routeRequestedAt: t0 } as DomainRow
    expect(needsRouteRequest(pending, new Date(t0.getTime() + 60_000))).toBe(false)
    expect(needsRouteRequest(pending, new Date(t0.getTime() + ROUTE_RETRY_MS))).toBe(true)
    const ready = { ...base, routeStatus: 'ready', routeRequestedAt: t0 } as DomainRow
    expect(needsRouteRequest(ready, new Date(t0.getTime() + ROUTE_RETRY_MS))).toBe(true)
  })

  it('never asks for pending, failed-DNS, certified or platform domains', () => {
    expect(needsRouteRequest({ ...base, status: 'pending' }, t0)).toBe(false)
    expect(needsRouteRequest({ ...base, status: 'failed' }, t0)).toBe(false)
    expect(needsRouteRequest({ ...base, sslStatus: 'active' }, t0)).toBe(false)
    expect(needsRouteRequest({ ...base, kind: 'platform' }, t0)).toBe(false)
  })
})

describe('the poll asks for routes', () => {
  it('queues a route for each verified domain, www twin included, when routing is on', async () => {
    const storeId = await seedStore('w')
    const [apex, www] = await connect(storeId, 'brand.test', { includeWwwTwin: true })

    const r = await pollPendingDomains(app, { provider, targets, now: t0, requestRoutes: true })
    expect(r).toEqual({ stores: 1, checked: 2, failed: 0, routes: 2 })
    expect(await domainRow(apex?.id as string)).toMatchObject({
      status: 'active',
      sslStatus: 'issuing',
      routeStatus: 'pending',
      routeRequestedAt: t0,
    })
    const rows = await outboxRows()
    expect(rows.map((o) => [o.type, (o.payload as { domainId: string }).domainId]).sort()).toEqual(
      [
        ['domain.route_requested', apex?.id],
        ['domain.route_requested', www?.id],
      ].sort(),
    )

    // The next tick inside the retry window does not ask again.
    const again = await pollPendingDomains(app, {
      provider,
      targets,
      now: new Date(t0.getTime() + 60_000),
      requestRoutes: true,
    })
    expect(again.routes).toBe(0)
    expect(await outboxRows()).toHaveLength(2)

    // The relay hands each row to the route queue.
    expect((await relayRouteJobs(storeId)).map((j) => j.action)).toEqual(['add', 'add'])
  })

  it('keeps today’s behaviour when routing is off (Dokploy env unset)', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.test')
    const r = await pollPendingDomains(app, { provider, targets, now: t0 })
    expect(r).toEqual({ stores: 1, checked: 1, failed: 0, routes: 0 })
    expect(await domainRow(d?.id as string)).toMatchObject({
      status: 'active',
      routeStatus: 'none',
    })
    expect(await outboxRows()).toHaveLength(0)
  })

  it('asks once for a store address that never got its route', async () => {
    const storeId = await seedStore('old', { unrouted: true })
    const r = await pollPendingDomains(app, { provider, targets, now: t0, requestRoutes: true })
    expect(r).toEqual({ stores: 0, checked: 0, failed: 0, routes: 1 })
    const [row] = await owner.select().from(storeDomain).where(eq(storeDomain.storeId, storeId))
    expect(row).toMatchObject({ kind: 'platform', routeStatus: 'pending', sslStatus: 'issuing' })
    expect((await relayRouteJobs(storeId)).map((j) => j.action)).toEqual(['add'])

    // Asked already: the next tick leaves it to the route job.
    const again = await pollPendingDomains(app, { provider, targets, now: t0, requestRoutes: true })
    expect(again.routes).toBe(0)
  })

  it('does not ask again for a refused store address, so the row is not rewritten', async () => {
    const storeId = await seedStore('old', { unrouted: true })
    await pollPendingDomains(app, { provider, targets, now: t0, requestRoutes: true })
    await relayRouteJobs(storeId)
    // The route job refused the hostname: `none`, with the request time kept.
    await owner
      .update(storeDomain)
      .set({ routeStatus: 'none' })
      .where(eq(storeDomain.storeId, storeId))

    const later = new Date(t0.getTime() + 2 * 60_000)
    const r = await pollPendingDomains(app, { provider, targets, now: later, requestRoutes: true })
    expect(r.routes).toBe(0)
    const [row] = await owner.select().from(storeDomain).where(eq(storeDomain.storeId, storeId))
    expect(row).toMatchObject({ routeStatus: 'none', routeRequestedAt: t0 })
  })

  it('leaves store addresses alone when routing is off', async () => {
    await seedStore('old', { unrouted: true })
    const r = await pollPendingDomains(app, { provider, targets, now: t0 })
    expect(r.routes).toBe(0)
    expect(await outboxRows()).toHaveLength(0)
  })

  it('does not ask while DNS is still pending', async () => {
    const storeId = await seedStore('w')
    await connect(storeId, 'real-brand.in')
    const r = await pollPendingDomains(app, { provider, targets, now: t0, requestRoutes: true })
    expect(r.routes).toBe(0)
    expect(await outboxRows()).toHaveLength(0)
  })
})

describe('runDomainRouteJob', () => {
  async function liveDomain(hostname = 'brand.test') {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, hostname)
    await pollPendingDomains(app, { provider, targets, now: t0, requestRoutes: true })
    const job: DomainRouteJob = { action: 'add', storeId, domainId: d?.id as string }
    return { storeId, id: d?.id as string, job }
  }

  it('adds the Dokploy domain and marks the route ready', async () => {
    const { id, job } = await liveDomain()
    const d = fakeDokploy()
    expect(await runDomainRouteJob({ db: app, client: d.client, guard }, job)).toBe('created')
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'brand.test' }])
    expect((await domainRow(id))?.routeStatus).toBe('ready')
  })

  it('does not create a duplicate when the domain is already in Dokploy', async () => {
    const { id, job } = await liveDomain()
    const d = fakeDokploy([{ domainId: 'hand', host: 'brand.test' }])
    expect(await runDomainRouteJob({ db: app, client: d.client, guard }, job)).toBe('exists')
    expect(d.calls).toEqual(['list'])
    expect((await domainRow(id))?.routeStatus).toBe('ready')
  })

  it('throws while Dokploy is down so the queue retries, then succeeds', async () => {
    const { id, job } = await liveDomain()
    const d = fakeDokploy()
    d.setDown(true)
    await expect(runDomainRouteJob({ db: app, client: d.client, guard }, job)).rejects.toThrow(
      /answered 502/,
    )
    expect((await domainRow(id))?.routeStatus).toBe('pending')
    d.setDown(false)
    expect(await runDomainRouteJob({ db: app, client: d.client, guard }, job)).toBe('created')
    expect((await domainRow(id))?.routeStatus).toBe('ready')
  })

  it('marks the route failed after the last retry and the poll asks again later', async () => {
    const { id, job } = await liveDomain()
    expect(ROUTE_JOB_ATTEMPTS).toBeGreaterThan(1)
    await markDomainRouteFailed(app, job)
    expect((await domainRow(id))?.routeStatus).toBe('failed')
    // DNS right, certificate still missing (no route on the proxy yet).
    const stuck: DomainProvider = {
      id: 'stuck',
      check: async () => ({ dns: 'verified', ssl: 'issuing', observed: [], error: null }),
    }
    const later = new Date(t0.getTime() + ROUTE_RETRY_MS)
    const r = await pollPendingDomains(app, {
      provider: stuck,
      targets,
      now: later,
      requestRoutes: true,
    })
    expect(r.routes).toBe(1)
    expect((await domainRow(id))?.routeStatus).toBe('pending')
  })

  it('never overwrites a ready route when a stale failure lands', async () => {
    const { id, job } = await liveDomain()
    await runDomainRouteJob({ db: app, client: fakeDokploy().client, guard }, job)
    await markDomainRouteFailed(app, job)
    expect((await domainRow(id))?.routeStatus).toBe('ready')
  })

  it('skips everything when Dokploy is not configured', async () => {
    const { id, job } = await liveDomain()
    expect(await runDomainRouteJob({ db: app, client: null, guard }, job)).toBe('skipped')
    expect(
      await runDomainRouteJob(
        { db: app, client: null, guard },
        { action: 'remove', storeId: job.storeId, hostname: 'brand.test' },
      ),
    ).toBe('skipped')
    expect((await domainRow(id))?.routeStatus).toBe('pending')
  })

  it('skips a domain that was removed or is not live', async () => {
    const storeId = await seedStore('w')
    const [pending] = await connect(storeId, 'real-brand.in')
    const d = fakeDokploy()
    const deps = { db: app, client: d.client, guard }
    expect(
      await runDomainRouteJob(deps, { action: 'add', storeId, domainId: pending?.id as string }),
    ).toBe('skipped')
    expect(
      await runDomainRouteJob(deps, {
        action: 'add',
        storeId,
        domainId: '00000000-0000-4000-8000-000000000000',
      }),
    ).toBe('skipped')
    expect(d.calls).toEqual([])
  })

  it('refuses a row whose hostname is a platform domain', async () => {
    const { storeId, id, job } = await liveDomain()
    await owner
      .update(storeDomain)
      .set({ hostname: 'shop.waimers.store' })
      .where(eq(storeDomain.id, id))
    const d = fakeDokploy()
    const logs: string[] = []
    expect(
      await runDomainRouteJob(
        { db: app, client: d.client, guard, log: (m) => logs.push(m) },
        { ...job, storeId },
      ),
    ).toBe('skipped')
    expect(d.calls).toEqual([])
    expect(logs[0]).toMatch(/refused/)
    expect((await domainRow(id))?.routeStatus).toBe('none')
  })
})

describe('removing a domain deletes its route', () => {
  it('queues the removal and the job deletes the Dokploy domain', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.test')
    await pollPendingDomains(app, { provider, targets, now: t0, requestRoutes: true })
    const dokploy = fakeDokploy()
    const deps = { db: app, client: dokploy.client, guard }
    const [add] = await relayRouteJobs(storeId)
    await runDomainRouteJob(deps, add as DomainRouteJob)
    expect(dokploy.domains).toHaveLength(1)

    await withStore(app, storeId, (tx) => removeDomain(tx, storeId, d?.id as string))
    const [remove] = await relayRouteJobs(storeId)
    expect(remove).toEqual({ action: 'remove', storeId, hostname: 'brand.test' })
    expect(await runDomainRouteJob(deps, remove as DomainRouteJob)).toBe('removed')
    expect(dokploy.domains).toEqual([])
    // A retry after success finds nothing left to delete.
    expect(await runDomainRouteJob(deps, remove as DomainRouteJob)).toBe('absent')
  })

  it('writes nothing for a domain that never had a route', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.test')
    await withStore(app, storeId, (tx) => removeDomain(tx, storeId, d?.id as string))
    expect(await outboxRows()).toHaveLength(0)
  })

  it('leaves the route alone when the hostname is live again, and refuses platform hosts', async () => {
    const a = await seedStore('a')
    await connect(a, 'brand.test')
    await pollPendingDomains(app, { provider, targets, now: t0 })
    const dokploy = fakeDokploy([
      { domainId: 'x', host: 'brand.test' },
      { domainId: 'p', host: 'a.localhost' },
    ])
    const deps = { db: app, client: dokploy.client, guard }
    expect(
      await runDomainRouteJob(deps, { action: 'remove', storeId: a, hostname: 'brand.test' }),
    ).toBe('skipped')
    expect(
      await runDomainRouteJob(deps, { action: 'remove', storeId: a, hostname: 'a.localhost' }),
    ).toBe('skipped')
    expect(dokploy.calls).toEqual([])
  })
})

describe('runDomainRouteJob: store address (platform kind)', () => {
  const storeGuard = { ...guard, storeDomain: 'koomerce.app' }

  async function platformRow(hostname: string) {
    const storeId = await seedStore('p')
    const [row] = await withStore(app, storeId, (tx) =>
      tx
        .insert(storeDomain)
        .values({ storeId, hostname, routeStatus: 'pending', sslStatus: 'issuing' })
        .returning(),
    )
    const job: DomainRouteJob = { action: 'add', storeId, domainId: row?.id as string }
    return { id: row?.id as string, job }
  }

  it('adds the route and starts the certificate wait; it never assumes SSL is active', async () => {
    const { id, job } = await platformRow('asha.koomerce.app')
    const d = fakeDokploy()
    expect(await runDomainRouteJob({ db: app, client: d.client, guard: storeGuard }, job)).toBe(
      'created',
    )
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'asha.koomerce.app' }])
    const row = await domainRow(id)
    expect(row).toMatchObject({ routeStatus: 'ready', sslStatus: 'issuing' })
    expect(row?.sslStartedAt).toBeInstanceOf(Date)
  })

  it('re-registers when asked: deletes the old Dokploy domain, creates a new one, restarts the wait', async () => {
    const { id, job } = await platformRow('asha.koomerce.app')
    const d = fakeDokploy([{ domainId: 'old', host: 'asha.koomerce.app' }])
    const after: string[] = []
    const out = await runDomainRouteJob(
      {
        db: app,
        client: d.client,
        guard: storeGuard,
        afterReregister: async (_s, domainId) => {
          after.push(domainId)
        },
      },
      { ...job, reregister: true },
    )
    expect(out).toBe('created')
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'asha.koomerce.app' }])
    expect(d.calls).toContain('delete old')
    expect(after).toEqual([id])
    expect(await domainRow(id)).toMatchObject({ routeStatus: 'ready', sslStatus: 'issuing' })
  })

  it('is idempotent', async () => {
    const { job } = await platformRow('asha.koomerce.app')
    const d = fakeDokploy([{ domainId: 'x', host: 'asha.koomerce.app' }])
    expect(await runDomainRouteJob({ db: app, client: d.client, guard: storeGuard }, job)).toBe(
      'exists',
    )
    expect(d.domains).toHaveLength(1)
  })

  it('refuses a host that is not a single label under the store domain', async () => {
    const { job } = await platformRow('a.b.koomerce.app')
    const d = fakeDokploy()
    expect(await runDomainRouteJob({ db: app, client: d.client, guard: storeGuard }, job)).toBe(
      'skipped',
    )
    expect(d.domains).toEqual([])
  })

  it('throws when Dokploy is down so the queue retries, leaving the address issuing', async () => {
    const { id, job } = await platformRow('asha.koomerce.app')
    const d = fakeDokploy()
    d.setDown(true)
    await expect(
      runDomainRouteJob({ db: app, client: d.client, guard: storeGuard }, job),
    ).rejects.toThrow()
    expect((await domainRow(id))?.sslStatus).toBe('issuing')
  })
})

describe('route request with reregister', () => {
  it('reaches the route job as reregister, a plain request does not', async () => {
    const storeId = await seedStore('rr')
    const [a] = await connect(storeId, 'one.in')
    const [b] = await connect(storeId, 'two.in')
    await withStore(app, storeId, async (tx) => {
      await requestDomainRoute(tx, storeId, a?.id as string, t0, { reregister: true })
      await requestDomainRoute(tx, storeId, b?.id as string, t0)
    })
    const jobs = await relayRouteJobs(storeId)
    expect(jobs).toEqual([
      { action: 'add', storeId, domainId: a?.id, reregister: true },
      { action: 'add', storeId, domainId: b?.id },
    ])
  })
})

describe('redirect-only apex routes', () => {
  const MIDDLEWARE = 'apex-to-www@file'

  async function liveRow(hostname: string, over: Partial<typeof storeDomain.$inferInsert> = {}) {
    const storeId = await seedStore(hostname.replace(/\W/g, '-'))
    const [row] = await withStore(app, storeId, (tx) =>
      tx
        .insert(storeDomain)
        .values({
          storeId,
          hostname,
          kind: 'custom',
          status: 'active',
          sslStatus: 'issuing',
          routeStatus: 'pending',
          ...over,
        })
        .returning(),
    )
    const job: DomainRouteJob = { action: 'add', storeId, domainId: row?.id as string }
    return { job, row: row as DomainRow }
  }
  const redirecting = (initial: DokployDomain[] = []) => {
    const d = fakeDokploy(initial)
    d.client.apexMiddleware = MIDDLEWARE
    return d
  }
  const run = (d: ReturnType<typeof fakeDokploy>, job: DomainRouteJob) =>
    runDomainRouteJob({ db: app, client: d.client, guard }, job)

  it('puts the redirect on an apex, and never on a www, a primary or a store address', async () => {
    const client = { apexMiddleware: MIDDLEWARE }
    const row = { kind: 'custom', isPrimary: false, hostname: 'brand.in' } as const
    expect(routeMiddlewares(client, row)).toEqual([MIDDLEWARE])
    expect(routeMiddlewares(client, { ...row, hostname: 'brand.co.in' })).toEqual([MIDDLEWARE])
    expect(routeMiddlewares(client, { ...row, hostname: 'www.brand.in' })).toEqual([])
    expect(routeMiddlewares(client, { ...row, isPrimary: true })).toEqual([])
    expect(routeMiddlewares(client, { ...row, kind: 'platform' })).toEqual([])
    expect(routeMiddlewares({}, row)).toEqual([])
  })

  it('creates the apex route with the middleware', async () => {
    const { job } = await liveRow('brand.in')
    const d = redirecting()
    expect(await run(d, job)).toBe('created')
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'brand.in', middlewares: [MIDDLEWARE] }])
  })

  it('adds the www route with no middleware, so the tunnel reaches the storefront', async () => {
    const { job } = await liveRow('www.brand.in')
    const d = redirecting()
    await run(d, job)
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'www.brand.in' }])
  })

  it('replaces an apex route that would serve the storefront', async () => {
    const { job } = await liveRow('brand.in')
    const d = redirecting([{ domainId: 'old', host: 'brand.in' }])
    expect(await run(d, job)).toBe('created')
    expect(d.calls).toContain('delete old')
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'brand.in', middlewares: [MIDDLEWARE] }])
  })

  it('leaves an apex route that already redirects', async () => {
    const { job } = await liveRow('brand.in')
    const d = redirecting([{ domainId: 'x', host: 'brand.in', middlewares: [MIDDLEWARE] }])
    expect(await run(d, job)).toBe('exists')
    expect(d.calls).toEqual(['list'])
  })

  it('never adds a redirect to an apex that is still primary', async () => {
    const { job } = await liveRow('brand.in', { isPrimary: false })
    await owner
      .update(storeDomain)
      .set({ isPrimary: false })
      .where(eq(storeDomain.storeId, job.storeId))
    await owner
      .update(storeDomain)
      .set({ isPrimary: true })
      .where(eq(storeDomain.hostname, 'brand.in'))
    const d = redirecting([{ domainId: 'x', host: 'brand.in' }])
    expect(await run(d, job)).toBe('exists')
  })
})

describe('removing a domain from Cloudflare', () => {
  it('queues the removal for a row Cloudflare took on, even with no route', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'www.brand.in')
    await owner
      .update(storeDomain)
      .set({ edgeRecords: [] })
      .where(eq(storeDomain.id, d?.id as string))
    await withStore(app, storeId, (tx) => removeDomain(tx, storeId, d?.id as string))
    const [job] = await relayRouteJobs(storeId)
    expect(job).toEqual({ action: 'remove', storeId, hostname: 'www.brand.in' })
  })

  it('releases the hostname even when Dokploy is not configured', async () => {
    const storeId = await seedStore('w')
    const released: string[] = []
    const out = await runDomainRouteJob(
      {
        db: app,
        client: null,
        guard,
        releaseEdgeHostname: async (host) => {
          released.push(host)
        },
      },
      { action: 'remove', storeId, hostname: 'www.brand.in' },
    )
    expect(out).toBe('absent')
    expect(released).toEqual(['www.brand.in'])
  })

  it('releases it alongside the route, and retries when Cloudflare fails', async () => {
    const storeId = await seedStore('w')
    const dokploy = fakeDokploy([{ domainId: 'x', host: 'www.brand.in' }])
    const job = { action: 'remove', storeId, hostname: 'www.brand.in' } as const
    const failing = {
      db: app,
      client: dokploy.client,
      guard,
      releaseEdgeHostname: async () => {
        throw new Error('Cloudflare custom_hostnames.delete answered 500')
      },
    }
    await expect(runDomainRouteJob(failing, job)).rejects.toThrow('answered 500')
    const working = { ...failing, releaseEdgeHostname: async () => undefined }
    expect(await runDomainRouteJob(working, job)).toBe('removed')
  })

  it('never releases a platform hostname or one that is live again', async () => {
    const storeId = await seedStore('w')
    await connect(storeId, 'brand.test')
    await pollPendingDomains(app, { provider, targets, now: t0 })
    const released: string[] = []
    const deps = {
      db: app,
      client: null,
      guard,
      releaseEdgeHostname: async (host: string) => {
        released.push(host)
      },
    }
    await runDomainRouteJob(deps, { action: 'remove', storeId, hostname: 'w.localhost' })
    await runDomainRouteJob(deps, { action: 'remove', storeId, hostname: 'brand.test' })
    expect(released).toEqual([])
  })

  it('still skips an add job with no Dokploy client', async () => {
    const deps = { db: app, client: null, guard, releaseEdgeHostname: async () => undefined }
    expect(await runDomainRouteJob(deps, { action: 'add', storeId: 's', domainId: 'd' })).toBe(
      'skipped',
    )
  })
})
