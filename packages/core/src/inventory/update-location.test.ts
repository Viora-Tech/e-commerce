/** SOURCE OF TRUTH: tests for ./update-location.ts — address edits, LOCATION_BILLING_FOLLOWS_STATE, store isolation. */
import { createDb, location, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { gstinCheckChar } from '../tax/gstin'
import { addRegistration, linkLocationRegistration } from '../tax/registrations'
import { defaultLocationId } from './levels'
import { updateLocation } from './update-location'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

function gstin(state: string, entity = '1'): string {
  const first14 = `${state}AAACW1234A${entity}Z`
  return first14 + gstinCheckChar(first14)
}

async function seedStore(slug = 'w') {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Shop ${slug}` })
    .returning()
  if (!s) throw new Error('seed')
  const locationId = await withStore(app, s.id, (tx) => defaultLocationId(tx, s.id))
  return { storeId: s.id, locationId }
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const read = async (id: string) => {
  const [row] = await owner.select().from(location).where(eq(location.id, id))
  return row
}

describe('updateLocation', () => {
  it('writes the address, clears blanks and keeps line 2 when left out', async () => {
    const { storeId, locationId } = await seedStore()
    await owner.update(location).set({ line2: 'Floor 2' }).where(eq(location.id, locationId))
    const row = await inStore(storeId, (tx) =>
      updateLocation(tx, storeId, {
        id: locationId,
        name: 'Gurugram warehouse',
        line1: 'Plot 4, Sector 18',
        city: 'Gurugram',
        stateCode: 'hr',
        pincode: '122015',
        phone: '+919812345678',
      }),
    )
    expect(row).toMatchObject({
      name: 'Gurugram warehouse',
      line1: 'Plot 4, Sector 18',
      line2: 'Floor 2',
      city: 'Gurugram',
      stateCode: 'HR',
      pincode: '122015',
      phone: '+919812345678',
      isDefault: true,
    })

    await inStore(storeId, (tx) =>
      updateLocation(tx, storeId, { id: locationId, name: 'Main', line1: '', pincode: '' }),
    )
    expect(await read(locationId)).toMatchObject({
      name: 'Main',
      line1: null,
      line2: 'Floor 2',
      city: null,
      stateCode: null,
      pincode: null,
      phone: null,
    })
  })

  it('refuses a state that is not on the list', async () => {
    const { storeId, locationId } = await seedStore()
    await expect(
      inStore(storeId, (tx) =>
        updateLocation(tx, storeId, { id: locationId, name: 'Main', stateCode: 'XX' }),
      ),
    ).rejects.toMatchObject({ code: 'BAD_STATE' })
  })

  it('picks the only GST number in the new state, and leaves two for the merchant', async () => {
    const { storeId, locationId } = await seedStore()
    const hr = await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: gstin('06') }))
    await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: gstin('07') }))
    await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: gstin('07', '2') }))

    let row = await inStore(storeId, (tx) =>
      updateLocation(tx, storeId, { id: locationId, name: 'Main', stateCode: 'HR' }),
    )
    expect(row.gstRegistrationId).toBe(hr.id)

    // Moved to Delhi: the Haryana number no longer fits, and Delhi has two to choose from.
    row = await inStore(storeId, (tx) =>
      updateLocation(tx, storeId, { id: locationId, name: 'Main', stateCode: 'DL' }),
    )
    expect(row.gstRegistrationId).toBeNull()
  })

  it('keeps a chosen GST number that still fits the state', async () => {
    const { storeId, locationId } = await seedStore()
    await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: gstin('07') }))
    const second = await inStore(storeId, (tx) =>
      addRegistration(tx, storeId, { gstin: gstin('07', '2') }),
    )
    await inStore(storeId, (tx) =>
      linkLocationRegistration(tx, storeId, { locationId, gstRegistrationId: second.id }),
    )
    const row = await inStore(storeId, (tx) =>
      updateLocation(tx, storeId, { id: locationId, name: 'Delhi', stateCode: 'DL' }),
    )
    expect(row.gstRegistrationId).toBe(second.id)
  })

  it("cannot edit another store's location", async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await expect(
      inStore(b.storeId, (tx) =>
        updateLocation(tx, b.storeId, { id: a.locationId, name: 'Taken' }),
      ),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' })
    expect((await read(a.locationId))?.name).toBe('Default location')
  })
})
