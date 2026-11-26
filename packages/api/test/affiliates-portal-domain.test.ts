import { createMerchantAuth } from '@commerce/auth'
import { permissions } from '@commerce/core'
import { createDb, role, rolePermission, store, storeDomain, storeMember } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/** Affiliates › Settings › Portal address: the same domain flow, one hostname, two grants. */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
// The offline provider: `*.test` hosts verify on the first check, nothing leaves the machine.
const savedProvider = process.env.DOMAIN_PROVIDER
process.env.DOMAIN_PROVIDER = 'dev'

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
})

/** An owner whose store has the Affiliates app and, when given, a live primary custom domain. */
async function merchant(slug: string, primary: string | null) {
  const headers = await signIn(`${slug}@example.com`)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  const organizationId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId, apps: { installed: ['affiliates'] } })
    .returning()
  if (!s) throw new Error('seed')
  await call(appRouter.staff.me, {}, { context: ctx(headers) })
  await owner.insert(storeDomain).values({
    storeId: s.id,
    hostname: `${slug}.koomerce.app`,
    kind: 'platform',
    isPrimary: primary === null,
  })
  if (primary) {
    await owner.insert(storeDomain).values({
      storeId: s.id,
      hostname: primary,
      kind: 'custom',
      status: 'active',
      sslStatus: 'active',
      isPrimary: true,
    })
  }
  return { headers, organizationId, storeId: s.id }
}

/** A member on a role of its own with exactly `perms`. */
async function memberWith(
  m: { organizationId: string; storeId: string },
  email: string,
  perms: string[],
) {
  const headers = await signIn(email)
  const userId = (await auth.api.getSession({ headers }))?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId: m.organizationId } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: m.organizationId } })
  const [r] = await owner
    .insert(role)
    .values({ storeId: m.storeId, name: email, slug: email.split('@')[0] as string })
    .returning()
  await owner
    .insert(rolePermission)
    .values(perms.map((permission) => ({ storeId: m.storeId, roleId: r?.id as string, permission })))
  await owner.insert(storeMember).values({ storeId: m.storeId, userId, roleId: r?.id as string })
  return headers
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  if (savedProvider === undefined) delete process.env.DOMAIN_PROVIDER
  else process.env.DOMAIN_PROVIDER = savedProvider
  await owner.$client.end()
  await app.$client.end()
})

describe('affiliates.portalDomain', () => {
  it('connects affiliate.<primary domain> through the domain flow, verifies and disconnects', async () => {
    const m = await merchant('portal-a', 'www.portal-a.test')
    const c = { context: ctx(m.headers) }

    const before = await call(appRouter.affiliates.portalDomain.get, undefined, c)
    expect(before).toMatchObject({
      hostname: 'affiliate.portal-a.test',
      fallbackUrl: 'https://www.portal-a.test/affiliate',
      domain: null,
    })

    const connected = await call(appRouter.affiliates.portalDomain.connect, undefined, c)
    expect(connected.domain).toMatchObject({
      hostname: 'affiliate.portal-a.test',
      kind: 'custom',
      status: 'pending',
      isPrimary: false,
      redirectToPrimary: false,
    })
    // The records come from the same builder as Settings › Domains: a CNAME and the TXT.
    const records = connected.domain?.records ?? []
    expect(records.map((r) => `${r.type} ${r.name}`)).toEqual(
      expect.arrayContaining(['CNAME affiliate', 'TXT _waimers-verify.affiliate']),
    )
    // No www twin, and the same row shows on the Domains page.
    const all = await call(appRouter.domains.list, undefined, c)
    expect(all.map((d) => d.hostname).sort()).toEqual([
      'affiliate.portal-a.test',
      'portal-a.koomerce.app',
      'www.portal-a.test',
    ])
    // Connecting again is a no-op, not "already connected".
    const again = await call(appRouter.affiliates.portalDomain.connect, undefined, c)
    expect(again.domain?.id).toBe(connected.domain?.id)

    const verified = await call(appRouter.affiliates.portalDomain.verify, undefined, c)
    expect(verified.domain?.status).toBe('active')

    const removed = await call(appRouter.affiliates.portalDomain.remove, undefined, c)
    expect(removed.domain).toBeNull()
    const rows = await owner.select().from(storeDomain).where(eq(storeDomain.storeId, m.storeId))
    expect(rows.map((r) => r.hostname)).not.toContain('affiliate.portal-a.test')
  })

  it('offers nothing to connect while the primary is the platform address', async () => {
    const m = await merchant('portal-b', null)
    const c = { context: ctx(m.headers) }
    expect(await call(appRouter.affiliates.portalDomain.get, undefined, c)).toMatchObject({
      hostname: null,
      fallbackUrl: 'https://portal-b.koomerce.app/affiliate',
      domain: null,
    })
    await expect(
      call(appRouter.affiliates.portalDomain.connect, undefined, c),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
    await expect(call(appRouter.affiliates.portalDomain.verify, undefined, c)).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    )
  })

  it('needs the Affiliates grant and the Domains grant together', async () => {
    const m = await merchant('portal-c', 'www.portal-c.test')
    const marketingOnly = await memberWith(m, 'marketer@example.com', [
      permissions.MARKETING_READ,
      permissions.MARKETING_WRITE,
      permissions.SETTINGS_READ,
    ])
    const settingsOnly = await memberWith(m, 'settings@example.com', [
      permissions.SETTINGS_READ,
      permissions.SETTINGS_MANAGE,
    ])
    const both = await memberWith(m, 'both@example.com', [
      permissions.MARKETING_READ,
      permissions.MARKETING_WRITE,
      permissions.SETTINGS_READ,
      permissions.SETTINGS_MANAGE,
    ])
    const connect = appRouter.affiliates.portalDomain.connect

    // Reading works with the app's read and Settings read; connecting also needs Domains manage.
    await expect(
      call(appRouter.affiliates.portalDomain.get, undefined, { context: ctx(marketingOnly) }),
    ).resolves.toMatchObject({ hostname: 'affiliate.portal-c.test' })
    await expect(
      call(connect, undefined, { context: ctx(marketingOnly) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      call(appRouter.affiliates.portalDomain.get, undefined, { context: ctx(settingsOnly) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(call(connect, undefined, { context: ctx(settingsOnly) })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    const done = await call(connect, undefined, { context: ctx(both) })
    expect(done.domain?.hostname).toBe('affiliate.portal-c.test')
    await expect(
      call(appRouter.affiliates.portalDomain.remove, undefined, { context: ctx(marketingOnly) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('refuses while the Affiliates app is not installed', async () => {
    const m = await merchant('portal-d', 'www.portal-d.test')
    await owner.update(store).set({ apps: { installed: [] } }).where(eq(store.id, m.storeId))
    await expect(
      call(appRouter.affiliates.portalDomain.get, undefined, { context: ctx(m.headers) }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })
})
