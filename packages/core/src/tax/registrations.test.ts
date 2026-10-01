/** SOURCE OF TRUTH: tests for ./registrations.ts — PAN_MUST_MATCH_BUSINESS, ONE_DEFAULT_REGISTRATION, the store.gstin mirror, location billing and store isolation. */
import { createDb, location, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { gstinCheckChar } from './gstin'
import {
  addRegistration,
  adoptStoreGstin,
  cancelRegistration,
  createBusiness,
  GstRegistrationError,
  linkLocationRegistration,
  listBusinessGst,
  setDefaultRegistration,
  updateBusiness,
  updateRegistration,
} from './registrations'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A GSTIN that passes the checksum: state digits + PAN + entity + Z + check. */
function gstin(state: string, pan: string, entity = '1'): string {
  const first14 = `${state}${pan}${entity}Z`
  return first14 + gstinCheckChar(first14)
}

const PAN = 'AAACW1234A'
const OTHER_PAN = 'BBBPK5678B'
const HR = gstin('06', PAN)
const DL = gstin('07', PAN)

async function seedStore(slug = 'w') {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Shop ${slug}` })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function storeGstin(storeId: string) {
  const [s] = await owner.select({ gstin: store.gstin }).from(store).where(eq(store.id, storeId))
  return s?.gstin ?? null
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (err) {
    if (err instanceof GstRegistrationError) return err.code
    throw err
  }
  throw new Error('expected a GstRegistrationError')
}

async function addLocation(storeId: string, name: string, stateCode: string | null) {
  const [l] = await owner.insert(location).values({ storeId, name, stateCode }).returning()
  if (!l) throw new Error('seed location')
  return l.id
}

describe('GST registrations', () => {
  it('first GSTIN creates the main business from its PAN, becomes default and fills store.gstin', async () => {
    const id = await seedStore()
    const reg = await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR.toLowerCase() }))
    expect(reg).toMatchObject({ gstin: HR, stateCode: '06', state: 'HR', isDefault: true })
    expect(reg.stateName).toBe('Haryana')

    const view = await inStore(id, (tx) => listBusinessGst(tx, id))
    expect(view.businesses).toHaveLength(1)
    expect(view.businesses[0]).toMatchObject({ pan: PAN, legalName: 'Shop w', isPrimary: true })
    expect(await storeGstin(id)).toBe(HR)
  })

  it('refuses a GSTIN whose PAN is not the business PAN, in plain words', async () => {
    const id = await seedStore()
    await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR }))
    const err = await inStore(id, (tx) =>
      addRegistration(tx, id, { gstin: gstin('07', OTHER_PAN) }),
    )
      .then(() => null)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GstRegistrationError)
    expect((err as GstRegistrationError).code).toBe('PAN_MISMATCH')
    expect((err as Error).message).toBe(
      'This GST number belongs to a different PAN. Is it another business?',
    )
  })

  it('refuses a GSTIN with a typo, and one already added', async () => {
    const id = await seedStore()
    const typo = `${HR.slice(0, 14)}${HR.endsWith('A') ? 'B' : 'A'}`
    expect(await codeOf(inStore(id, (tx) => addRegistration(tx, id, { gstin: typo })))).toBe(
      'INVALID_GSTIN',
    )
    await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR }))
    expect(await codeOf(inStore(id, (tx) => addRegistration(tx, id, { gstin: HR })))).toBe(
      'DUPLICATE_GSTIN',
    )
  })

  it('keeps one default: switching moves the badge and store.gstin', async () => {
    const id = await seedStore()
    await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR }))
    const dl = await inStore(id, (tx) => addRegistration(tx, id, { gstin: DL }))
    expect(dl.isDefault).toBe(false)

    await inStore(id, (tx) => setDefaultRegistration(tx, id, dl.id))
    const view = await inStore(id, (tx) => listBusinessGst(tx, id))
    expect(view.registrations.filter((r) => r.isDefault).map((r) => r.id)).toEqual([dl.id])
    expect(await storeGstin(id)).toBe(DL)

    const made = await inStore(id, (tx) =>
      addRegistration(tx, id, { gstin: gstin('27', PAN), makeDefault: true }),
    )
    expect(made.isDefault).toBe(true)
    expect(await storeGstin(id)).toBe(made.gstin)
  })

  it('has one main business; another business needs its own PAN', async () => {
    const id = await seedStore()
    const main = await inStore(id, (tx) =>
      createBusiness(tx, id, { legalName: 'Waimers Pvt Ltd', pan: PAN }),
    )
    const other = await inStore(id, (tx) =>
      createBusiness(tx, id, { legalName: 'Partner Traders', pan: OTHER_PAN.toLowerCase() }),
    )
    expect(main.isPrimary).toBe(true)
    expect(other).toMatchObject({ isPrimary: false, pan: OTHER_PAN })
    expect(
      await codeOf(inStore(id, (tx) => createBusiness(tx, id, { legalName: 'Again', pan: PAN }))),
    ).toBe('DUPLICATE_PAN')

    const theirs = await inStore(id, (tx) =>
      addRegistration(tx, id, { gstin: gstin('07', OTHER_PAN), businessId: other.id }),
    )
    expect(theirs.businessId).toBe(other.id)
    // The store's first GSTIN is the default, whichever business holds it.
    expect(theirs.isDefault).toBe(true)
  })

  it('locks the PAN once a business has GST numbers', async () => {
    const id = await seedStore()
    const b = await inStore(id, (tx) => createBusiness(tx, id, { legalName: 'W', pan: PAN }))
    const renamed = await inStore(id, (tx) =>
      updateBusiness(tx, id, {
        id: b.id,
        legalName: 'W Ltd',
        tradeName: 'Waimers',
        pan: OTHER_PAN,
      }),
    )
    expect(renamed).toMatchObject({ legalName: 'W Ltd', tradeName: 'Waimers', pan: OTHER_PAN })

    await inStore(id, (tx) => addRegistration(tx, id, { gstin: gstin('06', OTHER_PAN) }))
    expect(
      await codeOf(
        inStore(id, (tx) => updateBusiness(tx, id, { id: b.id, legalName: 'W', pan: PAN })),
      ),
    ).toBe('PAN_LOCKED')
  })

  it('cancelling the default hands it on, unlinks locations, and clears store.gstin at the end', async () => {
    const id = await seedStore()
    const hr = await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR }))
    const dl = await inStore(id, (tx) => addRegistration(tx, id, { gstin: DL }))
    const gurugram = await addLocation(id, 'Gurugram', 'HR')
    await inStore(id, (tx) =>
      linkLocationRegistration(tx, id, { locationId: gurugram, gstRegistrationId: hr.id }),
    )

    const cancelled = await inStore(id, (tx) => cancelRegistration(tx, id, hr.id))
    expect(cancelled).toMatchObject({ active: false, isDefault: false })
    expect(await storeGstin(id)).toBe(DL)
    const view = await inStore(id, (tx) => listBusinessGst(tx, id))
    const loc = view.locations.find((l) => l.id === gurugram)
    expect(loc).toMatchObject({ gstRegistrationId: null, stateUnregistered: true })

    await inStore(id, (tx) => cancelRegistration(tx, id, dl.id))
    expect(await storeGstin(id)).toBeNull()

    // Adding a cancelled number again brings the same row back.
    const back = await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR }))
    expect(back).toMatchObject({ id: hr.id, active: true, isDefault: true })
    expect(await codeOf(inStore(id, (tx) => setDefaultRegistration(tx, id, dl.id)))).toBe(
      'CANCELLED',
    )
  })

  it('a location only bills under a GSTIN of its own state', async () => {
    const id = await seedStore()
    const hr = await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR }))
    const delhi = await addLocation(id, 'Delhi', 'DL')
    const noState = await addLocation(id, 'Somewhere', null)

    const err = await inStore(id, (tx) =>
      linkLocationRegistration(tx, id, { locationId: delhi, gstRegistrationId: hr.id }),
    ).catch((e: unknown) => e)
    expect((err as GstRegistrationError).code).toBe('STATE_MISMATCH')
    expect((err as Error).message).toBe(
      'This GST number is for Haryana. A location in Delhi needs a Delhi GST number.',
    )

    await inStore(id, (tx) =>
      linkLocationRegistration(tx, id, { locationId: noState, gstRegistrationId: hr.id }),
    )
    let view = await inStore(id, (tx) => listBusinessGst(tx, id))
    expect(view.locations.find((l) => l.id === noState)?.gstRegistrationId).toBe(hr.id)
    expect(view.locations.find((l) => l.id === delhi)?.stateUnregistered).toBe(true)

    await inStore(id, (tx) =>
      linkLocationRegistration(tx, id, { locationId: noState, gstRegistrationId: null }),
    )
    view = await inStore(id, (tx) => listBusinessGst(tx, id))
    expect(view.locations.find((l) => l.id === noState)?.gstRegistrationId).toBeNull()
  })

  it('updates everything but the GSTIN', async () => {
    const id = await seedStore()
    const hr = await inStore(id, (tx) => addRegistration(tx, id, { gstin: HR }))
    const next = await inStore(id, (tx) =>
      updateRegistration(tx, id, {
        id: hr.id,
        tradeName: 'Waimers',
        invoicePrefix: 'hr',
        legalAddress: { line1: 'Plot 4', city: 'Manesar', pincode: '122050' },
        effectiveFrom: '2024-04-01',
      }),
    )
    expect(next).toMatchObject({
      gstin: HR,
      tradeName: 'Waimers',
      invoicePrefix: 'HR',
      effectiveFrom: '2024-04-01',
      legalAddress: { line1: 'Plot 4', line2: '', city: 'Manesar', pincode: '122050' },
    })
  })

  it('adoptStoreGstin: the old pages add the first GSTIN, then defer to Business and GST', async () => {
    const id = await seedStore()
    await inStore(id, (tx) => adoptStoreGstin(tx, id, null))
    expect((await inStore(id, (tx) => listBusinessGst(tx, id))).registrations).toEqual([])

    await inStore(id, (tx) => adoptStoreGstin(tx, id, HR, 'Waimers Pvt Ltd'))
    const view = await inStore(id, (tx) => listBusinessGst(tx, id))
    expect(view.businesses[0]?.legalName).toBe('Waimers Pvt Ltd')
    expect(view.registrations.map((r) => [r.gstin, r.isDefault])).toEqual([[HR, true]])

    await inStore(id, (tx) => adoptStoreGstin(tx, id, HR))
    expect(await codeOf(inStore(id, (tx) => adoptStoreGstin(tx, id, DL)))).toBe('MANAGED_ELSEWHERE')
  })

  it("cannot reach another store's business or registration", async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const theirs = await inStore(b, (tx) => addRegistration(tx, b, { gstin: HR }))
    const view = await inStore(a, (tx) => listBusinessGst(tx, a))
    expect(view.businesses).toEqual([])
    expect(view.registrations).toEqual([])
    expect(
      await codeOf(
        inStore(a, (tx) => addRegistration(tx, a, { gstin: HR, businessId: theirs.businessId })),
      ),
    ).toBe('NOT_FOUND')
    expect(await codeOf(inStore(a, (tx) => setDefaultRegistration(tx, a, theirs.id)))).toBe(
      'NOT_FOUND',
    )
  })
})
