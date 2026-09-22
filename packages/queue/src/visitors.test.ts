import IORedis from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createConnection } from './index'
import {
  EMPTY_LIVE_VISITORS,
  LIVE_MINUTES,
  liveVisitors,
  recordVisit,
  visitorsKey,
} from './visitors'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const storeId = `test-${Date.now()}`
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
