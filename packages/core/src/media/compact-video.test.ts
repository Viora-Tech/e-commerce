/** SOURCE OF TRUTH: smaller video copy rules — which videos skip the encode, the queue options */
import { describe, expect, it } from 'vitest'
import {
  BACKFILL_PRIORITY,
  COMPACT_VIDEO_JOB,
  compactPlan,
  compactVideoKey,
  enqueueCompactVideo,
  isVideoUrl,
  SMALL_VIDEO_BYTES,
  videoSources,
  withCompactVideos,
  worthKeeping,
} from './compact-video'
import type { MediaProcessQueue } from './queue'

const MB = 1024 * 1024

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

describe('compactPlan', () => {
  it('skips a video under the small size without looking further', () => {
    expect(compactPlan({ bytes: SMALL_VIDEO_BYTES - 1 })).toBe('small')
  })

  it('skips a lean video: low bitrate and no wider than the copy', () => {
    // 20 MB over 80 s is 2.1 Mbps.
    expect(compactPlan({ bytes: 20 * MB, durationSec: 80, width: 1920 })).toBe('lean')
  })

  it('encodes a heavy 1080p clip like the Waimers hero (34 MB, 20 s)', () => {
    expect(compactPlan({ bytes: 34 * MB, durationSec: 20, width: 1920 })).toBe('encode')
  })

  it('encodes a low-bitrate video wider than 1080p: the copy is scaled down', () => {
    expect(compactPlan({ bytes: 20 * MB, durationSec: 80, width: 3840 })).toBe('encode')
  })

  it('encodes when ffprobe could not tell the duration or width', () => {
    expect(compactPlan({ bytes: 20 * MB, durationSec: null, width: 1920 })).toBe('encode')
    expect(compactPlan({ bytes: 20 * MB, durationSec: 80, width: null })).toBe('encode')
  })
})

describe('video addresses and keys', () => {
  it('recognises video files, query strings included', () => {
    expect(isVideoUrl('https://c.x/a.mp4')).toBe(true)
    expect(isVideoUrl('https://c.x/a.MOV?v=1')).toBe(true)
    expect(isVideoUrl('https://c.x/a.jpg')).toBe(false)
  })

  it('puts the copy beside the original', () => {
    expect(compactVideoKey('stores/x/media/abc-hero.mov')).toBe('stores/x/media/abc-hero.small.mp4')
  })

  it('keeps a copy only when it saves at least a fifth', () => {
    expect(worthKeeping(100, 80)).toBe(true)
    expect(worthKeeping(100, 81)).toBe(false)
    expect(worthKeeping(100, 0)).toBe(false)
  })

  it('swaps video sources in theme HTML that have a copy', () => {
    const html =
      '<video><source src="https://c.x/a.mp4" type="video/mp4"></video><img src="https://c.x/a.jpg">'
    expect(videoSources(html)).toEqual(['https://c.x/a.mp4'])
    const copies = new Map([['https://c.x/a.mp4', 'https://c.x/a.small.mp4']])
    expect(withCompactVideos(html, copies)).toContain('src="https://c.x/a.small.mp4"')
  })
})

describe('enqueueCompactVideo', () => {
  it('keys the job by media id, so a repeat (upload, then the backfill sweep) is a no-op', async () => {
    const { queue, calls } = recordingQueue()
    await enqueueCompactVideo(queue, { storeId: 's1', mediaId: 'm1' })
    expect(calls[0]?.[0]).toBe(COMPACT_VIDEO_JOB)
    expect(calls[0]?.[2]).toMatchObject({ jobId: 'm1-video', attempts: 2 })
    expect(calls[0]?.[2]).not.toHaveProperty('priority')
  })

  it('puts a backfill job behind uploads', async () => {
    const { queue, calls } = recordingQueue()
    await enqueueCompactVideo(queue, { storeId: 's1', mediaId: 'm1' }, { backfill: true })
    expect(calls[0]?.[2]).toMatchObject({ jobId: 'm1-video', priority: BACKFILL_PRIORITY })
  })

  it('never throws when the queue is down', async () => {
    const { queue } = recordingQueue(true)
    await expect(
      enqueueCompactVideo(queue, { storeId: 's1', mediaId: 'm1' }),
    ).resolves.toBeUndefined()
  })
})
