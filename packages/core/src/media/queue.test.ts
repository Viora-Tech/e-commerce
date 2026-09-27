/** SOURCE OF TRUTH: media process queue tests — job id per media id, which enqueue throws */
import { describe, expect, it } from 'vitest'
import { addMediaProcessJob, enqueueMediaProcess, type MediaProcessQueue } from './queue'

function recordingQueue(failing = false) {
  const calls: Parameters<MediaProcessQueue['add']>[] = []
  const queue: MediaProcessQueue = {
    async add(...args) {
      calls.push(args)
      if (failing) throw new Error('redis down')
    },
  }
  return { queue, calls }
}

describe('media process queue', () => {
  it('keys every job by media id so a repeat enqueue is a no-op in BullMQ', async () => {
    const { queue, calls } = recordingQueue()
    await addMediaProcessJob(queue, { storeId: 's1', mediaId: 'm1' })
    await enqueueMediaProcess(queue, { storeId: 's1', mediaId: 'm2' })
    expect(calls.map(([name, data, opts]) => [name, data.mediaId, opts?.jobId])).toEqual([
      ['process', 'm1', 'm1'],
      ['process', 'm2', 'm2'],
    ])
    expect(calls[0]?.[2]).toMatchObject({ attempts: 5, backoff: { type: 'exponential' } })
  })

  it('addMediaProcessJob throws when the queue is down; enqueueMediaProcess does not', async () => {
    const { queue } = recordingQueue(true)
    await expect(addMediaProcessJob(queue, { storeId: 's1', mediaId: 'm1' })).rejects.toThrow(
      'redis down',
    )
    const quiet = console.error
    console.error = () => {}
    try {
      await expect(
        enqueueMediaProcess(queue, { storeId: 's1', mediaId: 'm1' }),
      ).resolves.toBeUndefined()
    } finally {
      console.error = quiet
    }
  })
})
