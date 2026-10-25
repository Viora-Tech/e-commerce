import IORedis from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createConnection } from './index'
import {
  dailyVisitors,
  EMPTY_LIVE_VISITORS,
  LIVE_MINUTES,
  liveVisitors,
  recordVisit,
  visitorsDayKey,
  visitorsKey,
} from './visitors'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
// Per worker and per run, so parallel test files and checkouts never share keys.
const storeId = `test-w${process.env.VITEST_POOL_ID ?? 0}-${Date.now()}`
let redis: ReturnType<typeof createConnection>

beforeAll(() => {
  redis = createConnection(redisUrl)
})

afterAll(async () => {
  const keys = await redis.keys(`{visitors}:${storeId}:*`)
  if (keys.length) await redis.del(...keys)
  await redis.quit()
})

describe('live visitors', () => {
  it('counts unique visitors per minute and across the window', async () => {
    const now = new Date('2026-09-22T10:30:15Z')
    await recordVisit(redis, storeId, 'visitor-a', now)
    await recordVisit(redis, storeId, 'visitor-a', now) // same person, same minute: still one
    await recordVisit(redis, storeId, 'visitor-b', now)
    await recordVisit(redis, storeId, 'visitor-a', new Date(now.getTime() - 5 * 60_000))

    const live = await liveVisitors(redis, storeId, now)
    expect(live.perMinute).toHaveLength(LIVE_MINUTES)
    expect(live.perMinute[LIVE_MINUTES - 1]).toBe(2)
    expect(live.perMinute[LIVE_MINUTES - 6]).toBe(1)
    expect(live.last30).toBe(2)
  })

  it('drops visits older than the window', async () => {
    const now = new Date('2026-09-22T12:00:00Z')
    await recordVisit(redis, storeId, 'visitor-old', new Date(now.getTime() - 31 * 60_000))
    const live = await liveVisitors(redis, storeId, now)
    expect(live.last30).toBe(0)
  })

  it('expires its keys', async () => {
    const now = new Date('2026-09-22T13:00:00Z')
    await recordVisit(redis, storeId, 'visitor-c', now)
    const ttl = await redis.ttl(visitorsKey(storeId, Math.floor(now.getTime() / 60_000)))
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(2 * 3600)
  })

  it('returns zeros when Dragonfly is unreachable', async () => {
    // The shared connection queues commands until Dragonfly is back; a client that
    // refuses to queue is the same failure the helper must absorb.
    const dead = new IORedis('redis://127.0.0.1:1', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    })
    dead.on('error', () => undefined)
    const live = await liveVisitors(dead, storeId)
    expect(live).toEqual(EMPTY_LIVE_VISITORS)
    dead.disconnect()
  })
})

/* Its own store: the live tests above also write day keys for the same dates. */
const dayStoreId = `${storeId}-daily`

describe('daily visitors', () => {
  it('counts uniques per IST day and de-duplicates across the span', async () => {
    // 21 Sept 20:00 UTC is already the 22nd in IST, so both visits land on the 22nd.
    await recordVisit(redis, dayStoreId, 'day-a', new Date('2026-09-21T20:00:00Z'))
    await recordVisit(redis, dayStoreId, 'day-b', new Date('2026-09-22T04:00:00Z'))
    await recordVisit(redis, dayStoreId, 'day-a', new Date('2026-09-23T04:00:00Z'))

    const out = await dailyVisitors(redis, dayStoreId, ['2026-09-21', '2026-09-22', '2026-09-23'])
    expect(out.perDay).toEqual([0, 2, 1])
    // day-a came back on the 23rd, so the union is two people, not three visits.
    expect(out.total).toBe(2)
  })

  it('keeps day keys well past the live window', async () => {
    await recordVisit(redis, dayStoreId, 'day-c', new Date('2026-09-24T04:00:00Z'))
    const ttl = await redis.ttl(visitorsDayKey(dayStoreId, '2026-09-24'))
    expect(ttl).toBeGreaterThan(2 * 3600)
    expect(ttl).toBeLessThanOrEqual(90 * 86_400)
  })

  it('reads zeros when Dragonfly is unreachable', async () => {
    const dead = new IORedis('redis://127.0.0.1:1', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    })
    dead.on('error', () => undefined)
    expect(await dailyVisitors(dead, dayStoreId, ['2026-09-22'])).toEqual({ perDay: [0], total: 0 })
    dead.disconnect()
  })
})
