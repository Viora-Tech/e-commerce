import { createDb, customer, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { subscribeToNewsletter } from './newsletter'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

describe('newsletter signup', () => {
  it('stores the email as a customer with marketing consent, once', async () => {
    const [s] = await owner.insert(store).values({ slug: 'nl', name: 'NL' }).returning()
    const storeId = s?.id as string
    await owner
      .insert(customer)
      .values({ storeId, email: 'asha@example.com', name: 'Asha', tags: ['vip'] })

    expect(
      await inStore(storeId, (tx) => subscribeToNewsletter(tx, storeId, ' Asha@Example.com ')),
    ).toBe(true)
    expect(
      await inStore(storeId, (tx) => subscribeToNewsletter(tx, storeId, 'asha@example.com')),
    ).toBe(true)
    expect(
      await inStore(storeId, (tx) => subscribeToNewsletter(tx, storeId, 'new@example.com')),
    ).toBe(true)
    expect(await inStore(storeId, (tx) => subscribeToNewsletter(tx, storeId, 'not an email'))).toBe(
      false,
    )

    const rows = await owner.select().from(customer).orderBy(customer.email)
    expect(rows.map((r) => [r.email, r.name, r.acceptsMarketing, r.tags])).toEqual([
      ['asha@example.com', 'Asha', true, ['vip', 'newsletter']],
      ['new@example.com', null, true, ['newsletter']],
    ])
  })

  it('records when and where consent was given, and a new signup clears an unsubscribe', async () => {
    const [s] = await owner.insert(store).values({ slug: 'nl2', name: 'NL' }).returning()
    const storeId = s?.id as string
    await owner.insert(customer).values({
      storeId,
      email: 'gone@example.com',
      acceptsMarketing: false,
      unsubscribedAt: new Date('2026-01-01'),
    })
    await inStore(storeId, (tx) => subscribeToNewsletter(tx, storeId, 'gone@example.com'))
    const [c] = await owner.select().from(customer)
    expect(c).toMatchObject({
      acceptsMarketing: true,
      marketingConsentSource: 'newsletter',
      unsubscribedAt: null,
    })
    expect(c?.marketingConsentAt).toBeInstanceOf(Date)
  })
})
