/** SOURCE OF TRUTH: background work notice tests — when the admin says the store may be slower (image backlog over 50, or an import running), the minutes left from the measured rate or a fallback, and the backlog query under RLS */
import { createDb, media, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { backgroundWork, mediaBacklog } from './background-work'

describe('backgroundWork', () => {
  it('is quiet for a handful of images and no import', () => {
    expect(backgroundWork({ waiting: 0, finishedRecently: 0 }, false)).toEqual({
      busy: false,
      images: 0,
      importing: false,
      minutesLeft: null,
    })
    expect(backgroundWork({ waiting: 50, finishedRecently: 0 }, false).busy).toBe(false)
  })

  it('speaks up for a big backlog or a running import', () => {
    expect(backgroundWork({ waiting: 51, finishedRecently: 0 }, false).busy).toBe(true)
    expect(backgroundWork({ waiting: 0, finishedRecently: 0 }, true).busy).toBe(true)
  })

  it('estimates minutes from the last ten minutes’ rate, or six seconds an image', () => {
    // 100 finished in 10 minutes = 10 a minute; 200 waiting = 20 minutes.
    expect(backgroundWork({ waiting: 200, finishedRecently: 100 }, false).minutesLeft).toBe(20)
    // Nothing finished yet: 200 × 6 s = 20 minutes.
    expect(backgroundWork({ waiting: 200, finishedRecently: 0 }, false).minutesLeft).toBe(20)
    expect(backgroundWork({ waiting: 1, finishedRecently: 500 }, false).minutesLeft).toBe(1)
  })
})

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('mediaBacklog', () => {
  it('counts this store’s images still processing and the ones finished lately', async () => {
    const [a, b] = await owner
      .insert(store)
      .values([
        { slug: 'a', name: 'A' },
        { slug: 'b', name: 'B' },
      ])
      .returning()
    const storeId = a?.id as string
    const now = new Date()
    const row = (
      s: string,
      status: 'pending' | 'processing' | 'ready',
      processedAt: Date | null,
    ) => ({
      storeId: s,
      url: `https://cdn.example/${Math.random()}`,
      status,
      processedAt,
    })
    await owner
      .insert(media)
      .values([
        row(storeId, 'processing', null),
        row(storeId, 'processing', null),
        row(storeId, 'pending', null),
        row(storeId, 'ready', new Date(now.getTime() - 60_000)),
        row(storeId, 'ready', new Date(now.getTime() - 60 * 60_000)),
        row(b?.id as string, 'processing', null),
      ])
    const backlog = await withStore(app, storeId, (tx) => mediaBacklog(tx, now))
    expect(backlog).toEqual({ waiting: 2, finishedRecently: 1 })
  })
})
