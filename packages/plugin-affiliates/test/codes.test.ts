import { createDb, discount, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate, getAffiliate, recordAffiliateClick } from '../src/affiliates'
import { decideCodeRequest, listCodes, requestCode, rotateCoupon } from '../src/codes'
import { type AffiliateSettings, defaultAffiliateSettings } from '../src/settings'

/*
 * The codes table: a rotated coupon stops working and a new one is made; an approved code
 * request becomes the link code while the old one keeps counting clicks; taken or malformed
 * codes are refused.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const settings: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'auto' }
const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, apps: { installed: ['affiliates'], settings: { affiliates: {} } } })
    .returning()
  return s?.id as string
}

const join = (storeId: string, name: string) =>
  inStore(storeId, (tx) =>
    applyAsAffiliate(
      tx,
      storeId,
      { customerId: null, email: `${name}@ok.com`, phone: null, name, social: '', message: '' },
      settings,
      SECRET,
    ),
  )

const discountStatus = async (id: string | null) => {
  const [d] = await owner
    .select()
    .from(discount)
    .where(eq(discount.id, id ?? ''))
  return d?.status
}

describe('affiliate codes', () => {
  it('rotating a coupon disables the old one and makes a new one', async () => {
    const storeId = await seed()
    const a = await join(storeId, 'asha')
    const rotated = await inStore(storeId, (tx) => rotateCoupon(tx, storeId, a.id))
    expect(rotated.couponCode).not.toBe(a.couponCode)
    expect(await discountStatus(a.discountId)).toBe('disabled')
    expect(await discountStatus(rotated.discountId)).toBe('active')
    const codes = await inStore(storeId, (tx) => listCodes(tx, a.id))
    expect(
      codes
        .filter((c) => c.kind === 'coupon')
        .map((c) => c.status)
        .sort(),
    ).toEqual(['active', 'retired'])
  })

  it('an approved request becomes the link code; the old link keeps counting', async () => {
    const storeId = await seed()
    const a = await join(storeId, 'Asha K')
    await join(storeId, 'ravi')
    await expect(inStore(storeId, (tx) => requestCode(tx, storeId, a.id, 'ravi'))).rejects.toThrow(
      /taken/,
    )
    await expect(inStore(storeId, (tx) => requestCode(tx, storeId, a.id, 'a!'))).rejects.toThrow(
      /letters/,
    )
    await inStore(storeId, (tx) => requestCode(tx, storeId, a.id, 'asha'))
    const renamed = await inStore(storeId, (tx) => decideCodeRequest(tx, storeId, a.id, 'approve'))
    expect(renamed.code).toBe('asha')
    expect(renamed.couponCode).toBe('ASHA')
    expect(await discountStatus(a.discountId)).toBe('disabled')
    expect(await inStore(storeId, (tx) => recordAffiliateClick(tx, storeId, a.code))).toBe(true)
    expect(await inStore(storeId, (tx) => recordAffiliateClick(tx, storeId, 'asha'))).toBe(true)
    expect((await inStore(storeId, (tx) => getAffiliate(tx, a.id)))?.clicks).toBe(2)
  })

  it('a declined request is kept as declined', async () => {
    const storeId = await seed()
    const a = await join(storeId, 'meera')
    await inStore(storeId, (tx) => requestCode(tx, storeId, a.id, 'meera-styles'))
    const declined = await inStore(storeId, (tx) => decideCodeRequest(tx, storeId, a.id, 'decline'))
    expect(declined.code).toBe(a.code)
    expect(declined.codeRequest?.status).toBe('declined')
  })
})
