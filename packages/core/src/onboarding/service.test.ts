/** SOURCE OF TRUTH: createStore tests — store, domains, owner, defaults, idempotent retries and onboarding answers */
import {
  collection,
  createDb,
  shippingZone,
  store,
  storeDomain,
  storeMember,
  theme,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { listRoles } from '../permissions/service'
import { createStore, OnboardingError } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const OWNER_USER_ID = 'usr_test_owner'
const OTHER_USER_ID = 'usr_test_other'

const fakeOrg = (organizationId = 'org_test') => ({
  createOrganization: async (input: { name: string; slug: string }) => {
    expect(input.slug).toBeTruthy()
    return { organizationId }
  },
})

describe('createStore', () => {
  it('creates the organization, store, domains, owner member and defaults', async () => {
    let orgCalls = 0
    const result = await createStore({
      db: app,
      ownerUserId: OWNER_USER_ID,
      name: 'Asha Handlooms',
      slug: 'asha-handlooms',
      platformDomain: 'waimers.store',
      addLocalhostDomain: true,
      createOrganization: async (input) => {
        orgCalls += 1
        expect(input).toEqual({ name: 'Asha Handlooms', slug: 'asha-handlooms' })
        return { organizationId: 'org_asha' }
      },
    })

    expect(orgCalls).toBe(1)
    expect(result.created).toBe(true)
    expect(result.slug).toBe('asha-handlooms')
    expect(result.organizationId).toBe('org_asha')

    await withStore(app, result.storeId, async (tx) => {
      const roles = await listRoles(tx, result.storeId)
      expect(roles.map((r) => r.slug).sort()).toEqual(['admin', 'owner', 'staff'])

      const [member] = await tx
        .select({ roleId: storeMember.roleId, userId: storeMember.userId })
        .from(storeMember)
        .where(eq(storeMember.storeId, result.storeId))
      const ownerRole = roles.find((r) => r.slug === 'owner')
      expect(member?.userId).toBe(OWNER_USER_ID)
      expect(member?.roleId).toBe(ownerRole?.id)

      const [mainTheme] = await tx.select().from(theme).where(eq(theme.storeId, result.storeId))
      expect(mainTheme?.role).toBe('main')

      const zones = await tx
        .select()
        .from(shippingZone)
        .where(eq(shippingZone.storeId, result.storeId))
      expect(zones.length).toBeGreaterThan(0)

      const domains = await tx
        .select({ hostname: storeDomain.hostname, isPrimary: storeDomain.isPrimary })
        .from(storeDomain)
        .where(eq(storeDomain.storeId, result.storeId))
      expect(domains).toContainEqual({ hostname: 'asha-handlooms.waimers.store', isPrimary: true })
      expect(domains).toContainEqual({
        hostname: 'asha-handlooms.localhost',
        isPrimary: false,
      })
    })
  })

  it('is idempotent against double-submit: the same owner and slug resumes instead of duplicating', async () => {
    const input = {
      db: app,
      ownerUserId: OWNER_USER_ID,
      name: 'Asha Handlooms',
      slug: 'asha-handlooms',
      platformDomain: 'waimers.store',
      ...fakeOrg('org_asha'),
    }
    const first = await createStore(input)
    const second = await createStore(input)

    expect(first.storeId).toBe(second.storeId)
    expect(first.organizationId).toBe(second.organizationId)
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
  })

  it('rejects a reserved store address', async () => {
    await expect(
      createStore({
        db: app,
        ownerUserId: OWNER_USER_ID,
        name: 'Admin Store',
        slug: 'admin',
        platformDomain: 'waimers.store',
        ...fakeOrg(),
      }),
    ).rejects.toMatchObject({ code: 'SLUG_RESERVED' })
  })

  it('rejects a slug already taken by a different owner', async () => {
    await createStore({
      db: app,
      ownerUserId: OWNER_USER_ID,
      name: 'Asha Handlooms',
      slug: 'asha-handlooms',
      platformDomain: 'waimers.store',
      ...fakeOrg('org_asha'),
    })

    await expect(
      createStore({
        db: app,
        ownerUserId: OTHER_USER_ID,
        name: 'Copycat',
        slug: 'asha-handlooms',
        platformDomain: 'waimers.store',
        ...fakeOrg('org_other'),
      }),
    ).rejects.toBeInstanceOf(OnboardingError)
  })

  it('applies the onboarding answers once: starter collections, state, installed apps', async () => {
    const input = {
      db: app,
      ownerUserId: OWNER_USER_ID,
      name: 'Asha Handlooms',
      slug: 'asha-handlooms',
      platformDomain: 'waimers.store',
      profile: {
        sells: 'fashion' as const,
        sellsOn: 'shopify' as const,
        country: 'IN',
        state: 'Rajasthan',
      },
      installApps: ['shopify-import'],
      ...fakeOrg('org_asha'),
    }
    const result = await createStore(input)
    await createStore(input) // a retry must not duplicate anything

    await withStore(app, result.storeId, async (tx) => {
      const titles = (await tx.select({ title: collection.title }).from(collection))
        .map((c) => c.title)
        .sort()
      expect(titles).toEqual(['Best sellers', 'Kids', 'Men', 'New arrivals', 'Women'])

      const [row] = await tx.select().from(store).where(eq(store.id, result.storeId))
      expect(row?.businessProfile).toEqual({ sells: 'fashion', sellsOn: 'shopify' })
      expect(row?.address).toMatchObject({ state: 'Rajasthan', country: 'IN' })
      expect(row?.apps).toEqual({ installed: ['shopify-import'] })
    })
  })
})

// Audit 2026-09-28: a refused organization (e.g. over the limit) used to leave the
// store row behind, so the address stayed taken with no store.
describe('createStore when the organization is refused', () => {
  it('gives the store address back', async () => {
    const attempt = () =>
      createStore({
        db: app,
        ownerUserId: OWNER_USER_ID,
        name: 'Squat',
        slug: 'squatted',
        platformDomain: 'waimers.store',
        addLocalhostDomain: false,
        createOrganization: async () => {
          throw new Error('organization limit reached')
        },
      })
    await expect(attempt()).rejects.toThrow('organization limit reached')
    expect(await owner.select().from(store).where(eq(store.slug, 'squatted'))).toHaveLength(0)
    expect(
      await owner
        .select()
        .from(storeDomain)
        .where(eq(storeDomain.hostname, 'squatted.waimers.store')),
    ).toHaveLength(0)
    // Someone else can now have it.
    const other = await createStore({
      db: app,
      ownerUserId: OTHER_USER_ID,
      name: 'Real',
      slug: 'squatted',
      platformDomain: 'waimers.store',
      addLocalhostDomain: false,
      ...fakeOrg('org_real'),
    })
    expect(other.created).toBe(true)
  })
})
