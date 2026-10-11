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
    async createDomain(host) {
      calls.push(`create ${host}`)
      guardDown()
      const d = { domainId: `d${next++}`, host }
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

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  await owner
    .insert(storeDomain)
    .values({ storeId: s.id, hostname: `${slug}.localhost`, isPrimary: true })
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
  const storeGuard = { ...guard, storeDomain: 'vioratech.in' }

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
    const { id, job } = await platformRow('asha.vioratech.in')
    const d = fakeDokploy()
    expect(await runDomainRouteJob({ db: app, client: d.client, guard: storeGuard }, job)).toBe(
      'created',
    )
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'asha.vioratech.in' }])
    const row = await domainRow(id)
    expect(row).toMatchObject({ routeStatus: 'ready', sslStatus: 'issuing' })
    expect(row?.sslStartedAt).toBeInstanceOf(Date)
  })

  it('re-registers when asked: deletes the old Dokploy domain, creates a new one, restarts the wait', async () => {
    const { id, job } = await platformRow('asha.vioratech.in')
    const d = fakeDokploy([{ domainId: 'old', host: 'asha.vioratech.in' }])
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
    expect(d.domains).toEqual([{ domainId: 'd1', host: 'asha.vioratech.in' }])
    expect(d.calls).toContain('delete old')
    expect(after).toEqual([id])
    expect(await domainRow(id)).toMatchObject({ routeStatus: 'ready', sslStatus: 'issuing' })
  })

  it('is idempotent', async () => {
    const { job } = await platformRow('asha.vioratech.in')
    const d = fakeDokploy([{ domainId: 'x', host: 'asha.vioratech.in' }])
    expect(await runDomainRouteJob({ db: app, client: d.client, guard: storeGuard }, job)).toBe(
      'exists',
    )
    expect(d.domains).toHaveLength(1)
  })

  it('refuses a host that is not a single label under the store domain', async () => {
    const { job } = await platformRow('a.b.vioratech.in')
    const d = fakeDokploy()
    expect(await runDomainRouteJob({ db: app, client: d.client, guard: storeGuard }, job)).toBe(
      'skipped',
    )
    expect(d.domains).toEqual([])
  })

  it('throws when Dokploy is down so the queue retries, leaving the address issuing', async () => {
    const { id, job } = await platformRow('asha.vioratech.in')
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
