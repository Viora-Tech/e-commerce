import type { MediaProcessQueue } from '@commerce/queue'
import { describe, expect, it, vi } from 'vitest'

/* The sweep without a database: stores come from the SECURITY DEFINER lookup, each store's
   rows from a fake transaction. */
const state = vi.hoisted(() => ({
  stores: [] as string[],
  rows: {} as Record<string, { id: string; contentType: string }[]>,
  limits: [] as number[],
}))

vi.mock('@commerce/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@commerce/db')>()),
  storesWithVideosNeedingCopy: async () => state.stores,
  withStore: async (_db: unknown, storeId: string, fn: (tx: unknown) => unknown) =>
    fn({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async (n: number) => {
                state.limits.push(n)
                if (storeId === 'broken') throw new Error('db down')
                return state.rows[storeId] ?? []
              },
            }),
          }),
        }),
      }),
    }),
}))

// The real queueing rules, without the rest of core (its plugin registry needs every app built).
vi.mock('@commerce/core', () => import('../../../packages/core/src/media/compact-video'))
vi.mock('./video-compact', () => ({ compactVideo: vi.fn() }))
vi.mock('@commerce/queue', () => ({
  KEEP_FINISHED: {},
  MEDIA_VIDEO_QUEUE: '{media}-video',
  Queue: class {},
  Worker: class {},
}))

const { BACKFILL_PER_STORE, createVideoBackfill } = await import('./media-video')

function recordingQueue() {
  const calls: Parameters<MediaProcessQueue['add']>[] = []
  const queue: MediaProcessQueue = {
    async add(...args) {
      calls.push(args)
    },
  }
  return { queue, calls }
}

describe('video backfill sweep', () => {
  it('queues each video never looked at behind uploads, a store at a time', async () => {
    state.stores = ['s1', 'broken', 's2']
    state.rows = {
      s1: [
        { id: 'a', contentType: 'video/mp4' },
        { id: 'b', contentType: 'video/quicktime' },
      ],
      s2: [{ id: 'c', contentType: 'video/webm' }],
    }
    state.limits = []
    const { queue, calls } = recordingQueue()
    const result = await createVideoBackfill({} as never, queue).run()
    expect(result).toEqual({ stores: 3, queued: 3 })
    expect(calls.map((c) => [c[1].storeId, c[1].mediaId, c[2]?.jobId])).toEqual([
      ['s1', 'a', 'a-video'],
      ['s1', 'b', 'b-video'],
      ['s2', 'c', 'c-video'],
    ])
    expect(calls.every((c) => (c[2]?.priority ?? 0) > 0)).toBe(true)
    expect(state.limits).toEqual([BACKFILL_PER_STORE, BACKFILL_PER_STORE, BACKFILL_PER_STORE])
  })

  it('finds nothing to do once every video is looked at', async () => {
    state.stores = []
    const { queue, calls } = recordingQueue()
    await expect(createVideoBackfill({} as never, queue).run()).resolves.toEqual({
      stores: 0,
      queued: 0,
    })
    expect(calls).toEqual([])
  })
})
