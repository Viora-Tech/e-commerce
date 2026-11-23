import { builtInPaymentRegistry, parsePaymentSettings } from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { savePaymentAdjustment } from '../src/services/payments-adjustment.service'

/** A payment app's "Extra charge" card: only its own key in `store.payments.adjustments` moves. */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const env = { secret: 'test-secret-test-secret-test-secret-1234', previousSecrets: [] }
const registry = builtInPaymentRegistry()

async function makeStore(slug: string, payments: unknown) {
  const [s] = await owner.insert(store).values({ slug, name: slug, payments }).returning()
  return s?.id as string
}

async function savedSettings(storeId: string) {
  const [row] = await owner
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, storeId))
  return parsePaymentSettings(row?.payments)
}

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('savePaymentAdjustment', () => {
  it('sets and removes one provider fee, keeping the COD fee and the rest', async () => {
    const cod = { type: 'fixed' as const, value: 4900, label: 'COD handling' }
    const storeId = await makeStore('pay-adjust', {
      enabled: ['cod'],
      adjustments: { cod },
      expireUnpaidAfterMinutes: 45,
    })
    const fee = { type: 'percent' as const, value: 150, label: 'Platform fee' }
    await withStore(app, storeId, (tx) =>
      savePaymentAdjustment(tx, storeId, registry, env, 'snapmint', fee),
    )
    let saved = await savedSettings(storeId)
    expect(saved.adjustments).toEqual({ cod, snapmint: fee })
    expect(saved.enabled).toEqual(['cod'])
    expect(saved.expireUnpaidAfterMinutes).toBe(45)

    await withStore(app, storeId, (tx) =>
      savePaymentAdjustment(tx, storeId, registry, env, 'snapmint', null),
    )
    saved = await savedSettings(storeId)
    expect(saved.adjustments).toEqual({ cod })
  })
})
