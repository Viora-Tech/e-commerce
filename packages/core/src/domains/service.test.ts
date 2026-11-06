import { createDb, resolveHost, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { DOMAIN_HELD_ERROR } from './cloudflare-provider'
import { createDevDomainProvider, DEV_SSL_ISSUE_MS } from './dev-provider'
import { createDnsDomainProvider } from './dns-provider'
import {
  connectDomain,
  createDomainProvider,
  DomainError,
  domainView,
  listDomains,
  pollPendingDomains,
  removeDomain,
  setDomainRedirect,
  setPrimaryDomain,
  verifyDomain,
} from './service'

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
const opts = { platformRoots: ['localhost'], targets }
const provider = createDevDomainProvider()
const t0 = new Date('2026-09-23T10:00:00Z')
const later = (ms: number) => new Date(t0.getTime() + ms)

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  await owner
    .insert(storeDomain)
    .values({ storeId: s.id, hostname: `${slug}.localhost`, isPrimary: true })
  return s.id
}

const connect = (storeId: string, hostname: string, extra: object = {}) =>
  withStore(app, storeId, (tx) => connectDomain(tx, storeId, { hostname, ...extra }, opts))

const verify = (storeId: string, id: string, now = t0) =>
  withStore(app, storeId, (tx) => verifyDomain(tx, id, { provider, targets, now }))

describe('connectDomain', () => {
  it('adds a custom domain as pending with a verification token and DNS records', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'https://Brand.test/')
    expect(d).toMatchObject({
      hostname: 'brand.test',
      kind: 'custom',
      status: 'pending',
      sslStatus: 'pending',
      isPrimary: false,
    })
    expect(d?.verificationToken).toMatch(/^waimers-verify=[0-9a-f]{32}$/)
    expect(domainView(d as NonNullable<typeof d>, targets).records.map((r) => r.type)).toEqual([
      'A',
      'TXT',
    ])
  })

  it('connects the www twin as a redirect when asked', async () => {
    const storeId = await seedStore('w')
    const rows = await connect(storeId, 'brand.test', { includeWwwTwin: true })
    expect(rows.map((r) => [r.hostname, r.redirectToPrimary])).toEqual([
      ['brand.test', false],
      ['www.brand.test', true],
    ])
  })

  it('refuses platform domains, duplicates and bad input', async () => {
    const storeId = await seedStore('w')
    await expect(connect(storeId, 'shop.localhost')).rejects.toThrow(DomainError)
    await expect(connect(storeId, 'shops.waimers.localhost')).rejects.toThrow(/platform/)
    await expect(connect(storeId, 'not a domain')).rejects.toThrow(DomainError)
    await connect(storeId, 'brand.test')
    await expect(connect(storeId, 'BRAND.test')).rejects.toThrow(/already connected to this store/)
  })

  it("refuses another store's hostname without naming the store, and skips a taken twin", async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await connect(a, 'www.brand.test')
    await expect(connect(b, 'www.brand.test')).rejects.toThrow(/another store/)
    const rows = await connect(b, 'brand.test', { includeWwwTwin: true })
    expect(rows.map((r) => r.hostname)).toEqual(['brand.test'])
  })
})

describe('verifyDomain with the dev provider', () => {
  it('goes live on the first check, then the certificate is issued a minute later', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.test')
    const id = d?.id as string
    const first = await verify(storeId, id)
    expect(first).toMatchObject({ status: 'active', sslStatus: 'issuing', error: null })
    expect(first.verifiedAt).toEqual(t0)
    const second = await verify(storeId, id, later(DEV_SSL_ISSUE_MS))
    expect(second).toMatchObject({ status: 'active', sslStatus: 'active' })
    expect(second.verifiedAt).toEqual(t0)
    expect(second.lastCheckedAt).toEqual(later(DEV_SSL_ISSUE_MS))
  })

  it('stays pending for a domain whose records are not there yet', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.in')
    expect(await verify(storeId, d?.id as string)).toMatchObject({
      status: 'pending',
      sslStatus: 'pending',
      verifiedAt: null,
    })
  })

  it('fails a misconfigured domain with an error the merchant can act on', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'fail.brand.test')
    const r = await verify(storeId, d?.id as string)
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/CNAME record with the value shops\.waimers\.localhost/)
  })

  it('keeps a live domain live when a later check goes wrong', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.in')
    await owner.update(storeDomain).set({ status: 'active', sslStatus: 'active' })
    const r = await verify(storeId, d?.id as string)
    expect(r.status).toBe('active')
  })

  it('leaves platform domains alone', async () => {
    const storeId = await seedStore('w')
    const [platform] = await withStore(app, storeId, listDomains)
    const r = await verify(storeId, platform?.id as string)
    expect(r.lastCheckedAt).toBeNull()
  })
})

describe('verifyDomain with the dns provider', () => {
  it('builds the dns provider by id and refuses unknown ones', () => {
    expect(createDomainProvider('dns').id).toBe('dns')
    expect(() => createDomainProvider('edge')).toThrow(DomainError)
  })

  it('routes a real domain once DNS and the certificate check out, and keeps it on a timeout', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'kuldeepsaini.com')
    const id = d?.id as string
    const token = d?.verificationToken as string
    let tlsOk = false
    let lookupsFail = false
    const answer = (records: string[] | string[][]) =>
      lookupsFail
        ? Promise.reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }))
        : Promise.resolve(records)
    const dnsProvider = createDnsDomainProvider({
      resolver: {
        resolve4: () => answer([targets.aRecord]) as Promise<string[]>,
        resolveCname: () => answer([]) as Promise<string[]>,
        resolveTxt: () => answer([[token]]) as Promise<string[][]>,
      },
      tlsCheck: async () => tlsOk,
    })
    const check = (now: Date) =>
      withStore(app, storeId, (tx) => verifyDomain(tx, id, { provider: dnsProvider, targets, now }))

    expect(await check(t0)).toMatchObject({ status: 'active', sslStatus: 'issuing', error: null })
    expect(await resolveHost(app, 'kuldeepsaini.com')).toMatchObject({ storeId })

    lookupsFail = true
    expect(await check(later(1000))).toMatchObject({ status: 'active', sslStatus: 'issuing' })

    lookupsFail = false
    tlsOk = true
    expect(await check(later(2000))).toMatchObject({ status: 'active', sslStatus: 'active' })
  })
})

describe('primary domain and redirects', () => {
  it('refuses a domain that is not live with SSL yet', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.test')
    const id = d?.id as string
    const setPrimary = () => withStore(app, storeId, (tx) => setPrimaryDomain(tx, storeId, id))
    await expect(setPrimary()).rejects.toThrow(/active SSL/)
    await verify(storeId, id)
    await expect(setPrimary()).rejects.toThrow(/active SSL/)
  })

  it('switches the primary in one step and the storefront follows', async () => {
    const storeId = await seedStore('w')
    const [d, twin] = await connect(storeId, 'brand.test', { includeWwwTwin: true })
    for (const x of [d, twin]) {
      await verify(storeId, x?.id as string)
      await verify(storeId, x?.id as string, later(DEV_SSL_ISSUE_MS))
    }
    await withStore(app, storeId, (tx) => setPrimaryDomain(tx, storeId, d?.id as string))
    const rows = await withStore(app, storeId, listDomains)
    expect(rows.filter((r) => r.isPrimary).map((r) => r.hostname)).toEqual(['brand.test'])
    expect(rows[0]?.hostname).toBe('brand.test')

    expect(await resolveHost(app, 'www.brand.test')).toMatchObject({
      primaryHostname: 'brand.test',
      redirect: true,
    })
    // The old platform domain keeps serving until the merchant says otherwise.
    expect(await resolveHost(app, 'w.localhost')).toMatchObject({ redirect: false })
    const platform = rows.find((r) => r.kind === 'platform')
    await withStore(app, storeId, (tx) =>
      setDomainRedirect(tx, storeId, platform?.id as string, true),
    )
    expect(await resolveHost(app, 'w.localhost')).toMatchObject({
      primaryHostname: 'brand.test',
      redirect: true,
    })
  })

  it('will not point the primary at itself', async () => {
    const storeId = await seedStore('w')
    const [platform] = await withStore(app, storeId, listDomains)
    await expect(
      withStore(app, storeId, (tx) => setDomainRedirect(tx, storeId, platform?.id as string, true)),
    ).rejects.toThrow(/itself/)
  })
})

describe('removeDomain', () => {
  it('removes custom domains but never the platform or primary one', async () => {
    const storeId = await seedStore('w')
    const [platform] = await withStore(app, storeId, listDomains)
    const [d] = await connect(storeId, 'brand.test')
    const remove = (id: string) => withStore(app, storeId, (tx) => removeDomain(tx, storeId, id))
    await expect(remove(platform?.id as string)).rejects.toThrow(/platform/)
    expect(await remove(d?.id as string)).toBe(true)
    expect(await remove(d?.id as string)).toBe(false)
  })

  it('refuses the primary domain', async () => {
    const storeId = await seedStore('w')
    const [d] = await connect(storeId, 'brand.test')
    await owner.update(storeDomain).set({ isPrimary: false })
    await owner
      .update(storeDomain)
      .set({ status: 'active', sslStatus: 'active', isPrimary: true })
      .where(eq(storeDomain.id, d?.id as string))
    await expect(
      withStore(app, storeId, (tx) => removeDomain(tx, storeId, d?.id as string)),
    ).rejects.toThrow(/another primary/)
  })
})

describe('pollPendingDomains', () => {
  it('checks every store with domains in flight and leaves settled ones alone', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await connect(a, 'brand.test')
    await connect(b, 'real-brand.in')
    const [failed] = await connect(b, 'fail.other.test')
    await verify(b, failed?.id as string)

    const r = await pollPendingDomains(app, { provider, targets, now: t0 })
    expect(r).toEqual({ stores: 2, checked: 2, failed: 0, routes: 0 })
    const [aDomain] = (await withStore(app, a, listDomains)).filter((d) => d.kind === 'custom')
    expect(aDomain).toMatchObject({ status: 'active', sslStatus: 'issuing' })

    // Next tick: the certificate lands; the real domain is still waiting on DNS.
    const next = await pollPendingDomains(app, { provider, targets, now: later(DEV_SSL_ISSUE_MS) })
    expect(next).toEqual({ stores: 2, checked: 2, failed: 0, routes: 0 })
    const settled = await pollPendingDomains(app, {
      provider,
      targets,
      now: later(2 * DEV_SSL_ISSUE_MS),
    })
    expect(settled).toEqual({ stores: 1, checked: 1, failed: 0, routes: 0 })
  })

  it('logs and counts a provider failure without stopping', async () => {
    const a = await seedStore('a')
    await connect(a, 'brand.test')
    const logs: string[] = []
    const broken = {
      id: 'broken',
      check: async () => {
        throw new Error('provider down')
      },
    }
    const r = await pollPendingDomains(app, {
      provider: broken,
      targets,
      log: (m) => logs.push(m),
    })
    expect(r).toEqual({ stores: 1, checked: 0, failed: 1, routes: 0 })
    expect(logs[0]).toMatch(/provider down/)
  })
})

describe('cloudflare mode', () => {
  const edgeOpts = { ...opts, apexRedirectOnly: true }
  const connectEdge = (storeId: string, hostname: string, extra: object = {}) =>
    withStore(app, storeId, (tx) => connectDomain(tx, storeId, { hostname, ...extra }, edgeOpts))
  const live = { status: 'active', sslStatus: 'active' } as const

  it('connecting an apex brings its www first, the apex redirecting and the www serving', async () => {
    const storeId = await seedStore('w')
    const rows = await connectEdge(storeId, 'brand.in')
    expect(rows.map((r) => [r.hostname, r.redirectToPrimary])).toEqual([
      ['www.brand.in', false],
      ['brand.in', true],
    ])
  })

  it('connecting a www leaves the apex out unless asked for', async () => {
    const storeId = await seedStore('w')
    expect((await connectEdge(storeId, 'www.brand.in')).map((r) => r.hostname)).toEqual([
      'www.brand.in',
    ])
    const other = await seedStore('x')
    const rows = await connectEdge(other, 'www.other.in', { includeWwwTwin: true })
    expect(rows.map((r) => [r.hostname, r.redirectToPrimary])).toEqual([
      ['www.other.in', false],
      ['other.in', true],
    ])
  })

  it('refuses the whole connect when another store holds the www', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await connectEdge(a, 'www.brand.in')
    await expect(connectEdge(b, 'brand.in')).rejects.toThrow(
      'www.brand.in is connected to another store',
    )
    expect(await withStore(app, b, (tx) => listDomains(tx))).toHaveLength(1)
  })

  it('keeps an existing www and adds only the apex', async () => {
    const storeId = await seedStore('w')
    await connectEdge(storeId, 'www.brand.in')
    const rows = await connectEdge(storeId, 'brand.in')
    expect(rows.map((r) => r.hostname)).toEqual(['brand.in'])
  })

  it('still skips a clashing twin quietly outside this mode', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await connect(a, 'www.brand.in')
    const rows = await connect(b, 'brand.in', { includeWwwTwin: true })
    expect(rows.map((r) => r.hostname)).toEqual(['brand.in'])
  })

  it('refuses an apex as primary with clear copy, and takes its www', async () => {
    const storeId = await seedStore('w')
    const [www, apex] = await connectEdge(storeId, 'brand.in')
    await owner.update(storeDomain).set(live).where(eq(storeDomain.storeId, storeId))
    const setPrimary = (id: string, o = {}) =>
      withStore(app, storeId, (tx) => setPrimaryDomain(tx, storeId, id, o))
    await expect(setPrimary(apex?.id as string, { apexRedirectOnly: true })).rejects.toThrow(
      'brand.in can only redirect, so it cannot be primary. Make www.brand.in your primary domain instead.',
    )
    const row = await setPrimary(www?.id as string, { apexRedirectOnly: true })
    expect(row.isPrimary).toBe(true)
    expect(await setPrimary(apex?.id as string).then((r) => r.isPrimary)).toBe(true)
  })

  it('leaves an apex that is already primary serving, and does not touch the row', async () => {
    const storeId = await seedStore('w')
    const [apex] = await connect(storeId, 'brand.in')
    await owner
      .update(storeDomain)
      .set(live)
      .where(eq(storeDomain.id, apex?.id as string))
    const row = await withStore(app, storeId, (tx) =>
      setPrimaryDomain(tx, storeId, apex?.id as string),
    )
    const same = await withStore(app, storeId, (tx) =>
      setPrimaryDomain(tx, storeId, apex?.id as string, { apexRedirectOnly: true }),
    )
    expect(same.isPrimary).toBe(true)
    expect(domainView(row, targets, { apexRedirectOnly: true }).redirectOnly).toBe(false)
  })

  it('marks only a custom apex that is not primary as redirect-only', async () => {
    const storeId = await seedStore('w')
    const [www, apex] = await connectEdge(storeId, 'brand.in')
    const view = (r: unknown, o = { apexRedirectOnly: true }) =>
      domainView(r as Parameters<typeof domainView>[0], targets, o)
    expect(view(apex).redirectOnly).toBe(true)
    expect(view(www).redirectOnly).toBe(false)
    expect(view(apex, { apexRedirectOnly: false }).redirectOnly).toBe(false)
  })

  it('needs a Cloudflare config, and never prints one', () => {
    expect(() => createDomainProvider('cloudflare')).toThrow(
      'DOMAIN_PROVIDER=cloudflare needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID',
    )
    expect(
      createDomainProvider('cloudflare', { cloudflare: { apiToken: 't', zoneId: 'z' } }).id,
    ).toBe('cloudflare')
  })

  it('stores what the provider wants added, shows it, and clears it on another provider', async () => {
    const storeId = await seedStore('w')
    const [row] = await connectEdge(storeId, 'www.brand.in')
    const record = {
      type: 'TXT' as const,
      name: '_cf-custom-hostname.www',
      value: 'uuid',
      purpose: 'verification' as const,
    }
    const edge = {
      id: 'cloudflare',
      check: async () => ({
        dns: 'pending' as const,
        ssl: 'pending' as const,
        observed: [],
        error: 'waiting',
        edgeRecords: [record],
      }),
    }
    const id = row?.id as string
    const seen = await withStore(app, storeId, (tx) =>
      verifyDomain(tx, id, { provider: edge, targets, now: t0 }),
    )
    expect(seen.edgeRecords).toEqual([record])
    expect(domainView(seen, targets).records).toContainEqual(record)
    expect(domainView(seen, targets).records).toHaveLength(3)
    const back = await withStore(app, storeId, (tx) =>
      verifyDomain(tx, id, { provider, targets, now: t0 }),
    )
    expect(back.edgeRecords).toBeNull()
  })

  it('hands the provider the route state and the stored records', async () => {
    const storeId = await seedStore('w')
    const [row] = await connectEdge(storeId, 'www.brand.in')
    const id = row?.id as string
    await owner
      .update(storeDomain)
      .set({ routeStatus: 'ready', edgeRecords: [] })
      .where(eq(storeDomain.id, id))
    let seen: unknown
    const edge = {
      id: 'cloudflare',
      check: async (input: unknown) => {
        seen = input
        return { dns: 'pending' as const, ssl: 'pending' as const, observed: [], error: null }
      },
    }
    await withStore(app, storeId, (tx) =>
      verifyDomain(tx, id, { provider: edge, targets, now: t0 }),
    )
    expect(seen).toMatchObject({ routeReady: true, previous: { edgeRecords: [] } })
  })

  it('a live row Cloudflare stops confirming stays up and is polled again', async () => {
    const storeId = await seedStore('w')
    const [row] = await connectEdge(storeId, 'www.brand.in')
    const id = row?.id as string
    await owner.update(storeDomain).set(live).where(eq(storeDomain.id, id))
    const held = {
      id: 'cloudflare',
      check: async () => ({
        dns: 'pending' as const,
        ssl: 'issuing' as const,
        observed: [],
        error: 'waiting',
        edgeRecords: [],
      }),
    }
    const r = await withStore(app, storeId, (tx) =>
      verifyDomain(tx, id, { provider: held, targets, now: t0 }),
    )
    expect(r).toMatchObject({ status: 'active', sslStatus: 'issuing', error: 'waiting' })
    expect(await pollPendingDomains(app, { provider: held, targets, now: t0 })).toMatchObject({
      checked: 1,
    })
  })

  it('flags a held hostname for the admin', async () => {
    const storeId = await seedStore('w')
    const [row] = await connectEdge(storeId, 'www.brand.in')
    const held = { ...(row as NonNullable<typeof row>), error: DOMAIN_HELD_ERROR }
    expect(domainView(held, targets).heldElsewhere).toBe(true)
    expect(domainView(row as NonNullable<typeof row>, targets).heldElsewhere).toBe(false)
  })
})
