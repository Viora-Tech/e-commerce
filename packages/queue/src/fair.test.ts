import { Queue, Worker } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fairnessKey, fairProcessor, storeSlots } from './fair'
import { createConnection, QUEUE_LIMITS } from './index'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const run = `${Date.now()}`
let redis: ReturnType<typeof createConnection>

beforeAll(() => {
  redis = createConnection(redisUrl)
})

afterAll(async () => {
  const keys = await redis.keys(`fair:{test-fair-${run}}*`)
  if (keys.length) await redis.del(...keys)
  await redis.quit()
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('storeSlots', () => {
  const queue = `{test-fair-${run}}-slots`

  it('admits up to the cap per store, independently for each store', async () => {
    const slots = storeSlots(redis, queue, 2)
    expect(await slots.acquire('a', 'j1')).toBe(true)
    expect(await slots.acquire('a', 'j2')).toBe(true)
    expect(await slots.acquire('a', 'j3')).toBe(false)
    // A refused holder leaves nothing behind.
    expect(await slots.active('a')).toBe(2)
    // Store b is not affected by a's load.
    expect(await slots.acquire('b', 'j4')).toBe(true)
    await slots.release('a', 'j1')
    expect(await slots.acquire('a', 'j3')).toBe(true)
  })

  it('a lapsed lease (crashed worker) frees its slot; renew keeps a live one', async () => {
    const slots = storeSlots(redis, queue, 1, 1_000)
    const t0 = Date.now()
    expect(await slots.acquire('c', 'dead', t0)).toBe(true)
    expect(await slots.acquire('c', 'next', t0 + 500)).toBe(false)
    // Past the lease: the dead holder no longer counts.
    expect(await slots.acquire('c', 'next', t0 + 1_500)).toBe(true)

    expect(await slots.acquire('d', 'live', t0)).toBe(true)
    await slots.renew('d', 'live', t0 + 900)
    expect(await slots.acquire('d', 'other', t0 + 1_500)).toBe(false)
  })

  it('keys are per queue and per store', () => {
    expect(fairnessKey('{media}-process', 's1')).toBe('fair:{media}-process:s1')
  })

  it('every queue caps a store below its concurrency, so others always get a slot', () => {
    for (const limits of Object.values(QUEUE_LIMITS)) {
      expect(limits.perStore).toBeGreaterThanOrEqual(1)
      expect(limits.perStore).toBeLessThan(limits.concurrency)
    }
  })
})

describe('fairProcessor with a real BullMQ worker', () => {
  it("a store with a backlog cannot starve another store's job", async () => {
    const name = `{test-fair-${run}}-worker`
    const queue = new Queue<{ storeId: string; n: number }>(name, { connection: redis })
    const finished: string[] = []
    const running = new Map<string, number>()
    let maxRunningA = 0

    // Store A queues a backlog first, then store B one job.
    for (let n = 0; n < 6; n++) await queue.add('job', { storeId: 'A', n })
    await queue.add('job', { storeId: 'B', n: 0 })

    const workerConnection = createConnection(redisUrl)
    const worker = new Worker<{ storeId: string; n: number }>(
      name,
      fairProcessor(redis, name, { perStore: 1, retryDelayMs: 50 }, async (job) => {
        const s = job.data.storeId
        running.set(s, (running.get(s) ?? 0) + 1)
        if (s === 'A') maxRunningA = Math.max(maxRunningA, running.get(s) ?? 0)
        await sleep(150)
        running.set(s, (running.get(s) ?? 0) - 1)
        finished.push(`${s}${job.data.n}`)
      }),
      { connection: workerConnection, concurrency: 2 },
    )

    const deadline = Date.now() + 15_000
    while (finished.length < 7 && Date.now() < deadline) await sleep(50)
    await worker.close()
    await workerConnection.quit()
    await queue.obliterate({ force: true })
    await queue.close()

    expect(finished).toHaveLength(7)
    // Never more than the cap of A's jobs at once, though the worker had two slots.
    expect(maxRunningA).toBe(1)
    // B ran while A still had most of its backlog left (without the cap it would come last).
    expect(finished.indexOf('B0')).toBeLessThan(2)
  })

  it('jobs without a storeId run unthrottled', async () => {
    const slots: string[] = []
    const processor = fairProcessor<{ storeId?: string }, string>(
      redis,
      `{test-fair-${run}}-plain`,
      { perStore: 1 },
      async () => {
        slots.push('ran')
        return 'ok'
      },
    )
    // biome-ignore lint/suspicious/noExplicitAny: a minimal job stand-in; the wrapper reads only `data`.
    const job = { id: '1', data: {} } as any
    expect(await processor(job)).toBe('ok')
    expect(slots).toEqual(['ran'])
  })
})
