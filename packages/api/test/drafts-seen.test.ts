import { createDb, order, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { markDraftSeen, seenDraftIds } from '../src/services/drafts-seen.service'

/* The Drafts list dims a draft once this member has opened it (owner, 26 Nov 2026). */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'seen', name: 'Test store' }).returning()
  const storeId = s?.id as string
  const draft = async (n: number, source: 'checkout' | null) => {
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: -n,
        draftNumber: n,
        status: 'draft',
        draftSource: source,
        lastActivityAt: source ? new Date('2026-11-20T10:00:00Z') : null,
        subtotalPaise: 10_000,
        totalPaise: 10_000,
        email: `buyer${n}@example.com`,
      })
      .returning()
    return o?.id as string
  }
  return { storeId, checkout: await draft(1, 'checkout'), staff: await draft(2, null) }
}

describe('seen drafts', () => {
  it('marks a draft seen for the member who opened it only, until the shopper comes back', async () => {
    const { storeId, checkout, staff } = await seed()
    const ids = [checkout, staff]
    const seen = (user: string) => withStore(app, storeId, (tx) => seenDraftIds(tx, user, ids))
    expect(await seen('member-a')).toEqual(new Set())

    const at = new Date('2026-11-21T10:00:00Z')
    await withStore(app, storeId, async (tx) => {
      await markDraftSeen(tx, storeId, 'member-a', checkout, at)
      await markDraftSeen(tx, storeId, 'member-a', staff, at)
    })
    expect(await seen('member-a')).toEqual(new Set(ids))
    expect(await seen('member-b')).toEqual(new Set())

    // The shopper came back to the checkout: it is new again.
    await owner
      .update(order)
      .set({ lastActivityAt: new Date('2026-11-22T10:00:00Z') })
      .where(eq(order.id, checkout))
    expect(await seen('member-a')).toEqual(new Set([staff]))
  })
})
