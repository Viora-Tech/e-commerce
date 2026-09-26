import { createDb, shippingZone, storeDomain, storeMember, theme, withStore } from '@commerce/db'
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
})
