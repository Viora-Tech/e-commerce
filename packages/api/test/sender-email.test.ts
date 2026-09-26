import {
  checkSenderEmail,
  createDevSenderIdentityProvider,
  type PlatformEmail,
  setSenderEmail,
} from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { senderEmailDeps, senderEmailOverview } from '../src/services/sender-email.service'

/**
 * The Sender email card's data. The dev identity provider stands in for SES
 * (`*.test` verifies on the first check); nothing reaches AWS.
 */
const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const platform = (): PlatformEmail => ({
  fromEmail: 'no-reply@mail.platform.test',
  fromName: 'Waimers',
  identities: createDevSenderIdentityProvider(),
  reservedDomains: ['localhost', 'mail.platform.test'],
  transport: null,
})

async function makeStore(values: Partial<typeof store.$inferInsert> = {}) {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'se', name: 'Waimers Gear', contactEmail: 'owner@gmail.com', ...values })
    .returning()
  return s?.id as string
}

describe('senderEmailOverview', () => {
  it('shows the platform From with replies to the shop until verified, then the shop’s own', async () => {
    const storeId = await makeStore()
    const p = platform()
    const deps = senderEmailDeps(p)
    const read = () => withStore(app, storeId, (tx) => senderEmailOverview(tx, storeId, p))

    expect(await read()).toMatchObject({
      sender: null,
      storeName: 'Waimers Gear',
      ownApp: false,
      platformSending: false,
      preview: {
        from: 'Waimers Gear <no-reply@mail.platform.test>',
        replyTo: 'owner@gmail.com',
        using: 'platform',
      },
    })

    await withStore(app, storeId, (tx) =>
      setSenderEmail(
        tx,
        storeId,
        { email: 'support@brand.test', displayName: 'Brand Support' },
        deps,
      ),
    )
    const pending = await read()
    expect(pending.sender).toMatchObject({ email: 'support@brand.test', status: 'pending' })
    expect(pending.sender?.records.filter((r) => r.purpose === 'dkim')).toHaveLength(3)
    expect(pending.preview).toEqual({
      from: 'Brand Support <no-reply@mail.platform.test>',
      replyTo: 'support@brand.test',
      using: 'platform',
    })

    await withStore(app, storeId, (tx) => checkSenderEmail(tx, storeId, deps))
    expect((await read()).preview).toEqual({
      from: 'Brand Support <support@brand.test>',
      replyTo: null,
      using: 'own',
    })
  })

  it('says when the store’s own Amazon SES app sends instead', async () => {
    const storeId = await makeStore({ notifications: { enabled: ['ses'], providers: {} } })
    const r = await withStore(app, storeId, (tx) => senderEmailOverview(tx, storeId, platform()))
    expect(r.ownApp).toBe(true)
  })
})
