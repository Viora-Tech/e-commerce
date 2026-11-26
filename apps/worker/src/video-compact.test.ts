import { mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryStorageProvider } from '@commerce/storage/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/* No database here: `withStore` hands the job a fake transaction that returns the one row, and
   the two writes the job can make are recorded. No ffmpeg either: `tools` stands in for it. */
const state = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  provider: null as unknown,
  marks: [] as { kind: string; id: string; copy?: unknown }[],
  /** What `linkAutoPoster` answers: the poster id, or null when the video got one meanwhile. */
  linked: 'p-auto' as string | null,
}))

vi.mock('@commerce/db', () => ({
  media: { id: 'id' },
  withStore: async (_db: unknown, _storeId: string, fn: (tx: unknown) => unknown) =>
    fn({
      select: () => ({ from: () => ({ where: async () => (state.row ? [state.row] : []) }) }),
      update: () => ({
        set: (values: unknown) => ({
          where: async () => {
            state.marks.push({ kind: 'update', id: 'm1', copy: values })
          },
        }),
      }),
    }),
}))
vi.mock('@commerce/core/registries', () => ({ registriesForStore: async () => ({ storage: {} }) }))
vi.mock('@commerce/core', async () => {
  const rules = await vi.importActual<
    typeof import('../../../packages/core/src/media/compact-video')
  >('../../../packages/core/src/media/compact-video')
  return {
    compactPlan: rules.compactPlan,
    compactVideoKey: rules.compactVideoKey,
    copyShapeFor: rules.copyShapeFor,
    LANDSCAPE_COPY: rules.LANDSCAPE_COPY,
    videoPosterKey: rules.videoPosterKey,
    linkAutoPoster: async (_tx: unknown, _storeId: string, id: string, poster: unknown) => {
      state.marks.push({ kind: 'poster', id, copy: poster })
      return state.linked
    },
    isCompactableVideo: rules.isCompactableVideo,
    worthKeeping: rules.worthKeeping,
    storageForStore: async () => state.provider,
    markVideoCompact: async (_tx: unknown, id: string, copy: unknown) => {
      state.marks.push({ kind: 'copy', id, copy })
    },
    MEDIA_MISSING_ERROR: rules.MEDIA_MISSING_ERROR,
    markMediaMissing: async (_tx: unknown, id: string) => {
      state.marks.push({ kind: 'missing', id })
    },
    markVideoNoCopy: async (_tx: unknown, id: string) => {
      state.marks.push({ kind: 'none', id })
    },
  }
})

const { compactVideo, downloadToFile } = await import('./video-compact')

const MB = 1024 * 1024
const MISSING = 'File missing from storage'
const KEY = 'stores/s1/media/hero.mp4'

async function storeVideo(bytes: number) {
  const provider = new MemoryStorageProvider({ publicBaseUrl: 'https://cdn.test' })
  state.provider = provider
  await provider.put({ key: KEY, body: new Uint8Array(bytes), contentType: 'video/mp4' })
  return provider
}

/** A stand-in for ffmpeg: ffprobe answers `probe`, the encode writes a copy of `copyBytes`. */
function tools(
  copyBytes: number,
  probe: { width: number | null; durationSec: number | null; height?: number | null } = {
    width: 1920,
    durationSec: 20,
  },
  silent = false,
) {
  return {
    probe: vi.fn(async () => ({ height: null, ...probe })),
    encode: vi.fn(async (_in: string, out: string, _opts: unknown) =>
      writeFile(out, new Uint8Array(copyBytes)),
    ),
    silent: vi.fn(async () => silent),
    poster: vi.fn(async (_in: string, _frame: string, out: string) => {
      await writeFile(out, new Uint8Array(40 * 1024))
      return { width: 1280, height: 720, size: 40 * 1024 }
    }),
  }
}

const run = (t: ReturnType<typeof tools>, force = false) =>
  compactVideo({} as never, 's1', 'm1', 'secret', { tools: t, force })

beforeEach(() => {
  state.row = {
    id: 'm1',
    key: KEY,
    contentType: 'video/mp4',
    provider: 'memory',
    compactSize: null,
    // Copy tests: the video already has a poster (the merchant's), so none is made.
    posterMediaId: 'p-merchant',
  }
  state.marks = []
  state.linked = 'p-auto'
})

describe('compactVideo', () => {
  it('makes the copy, streams it back beside the original and saves its address', async () => {
    const provider = await storeVideo(12 * MB)
    await expect(run(tools(3 * MB))).resolves.toBe('made')
    expect(provider.streamed).toEqual(['stores/s1/media/hero.small.mp4'])
    expect((await provider.head(KEY))?.size).toBe(12 * MB) // the original is untouched
    expect(state.marks).toEqual([
      {
        kind: 'copy',
        id: 'm1',
        copy: {
          url: 'https://cdn.test/stores/s1/media/hero.small.mp4',
          key: 'stores/s1/media/hero.small.mp4',
          size: 3 * MB,
        },
      },
    ])
  })

  it('encodes a portrait phone video at the phone settings, without a silent track', async () => {
    await storeVideo(12 * MB)
    const t = tools(1 * MB, { width: 1080, height: 1920, durationSec: 10 }, true)
    await expect(run(t)).resolves.toBe('made')
    expect(t.encode).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      shape: expect.objectContaining({ maxWidth: 720, maxrateKbps: 1000 }),
      audio: false,
    })
  })

  it('keeps a landscape video at the usual settings, with its sound', async () => {
    await storeVideo(12 * MB)
    const t = tools(3 * MB)
    await expect(run(t)).resolves.toBe('made')
    expect(t.encode).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      shape: expect.objectContaining({ maxWidth: 1920, maxrateKbps: 3500 }),
      audio: true,
    })
  })

  it('never downloads a small video: its size comes from the bucket', async () => {
    const provider = await storeVideo(2 * MB)
    const get = vi.spyOn(provider, 'getStream')
    const t = tools(1 * MB)
    await expect(run(t)).resolves.toBe('small')
    expect(get).not.toHaveBeenCalled()
    expect(t.encode).not.toHaveBeenCalled()
    expect(state.marks).toEqual([{ kind: 'none', id: 'm1' }])
  })

  it('skips the encode for a lean video and marks it', async () => {
    await storeVideo(10 * MB)
    const t = tools(1 * MB, { width: 1280, durationSec: 60 }) // 1.4 Mbps
    await expect(run(t)).resolves.toBe('lean')
    expect(t.encode).not.toHaveBeenCalled()
    expect(state.marks).toEqual([{ kind: 'none', id: 'm1' }])
  })

  it('keeps the original when the copy is not a fifth smaller', async () => {
    const provider = await storeVideo(10 * MB)
    await expect(run(tools(9 * MB))).resolves.toBe('not-smaller')
    expect(provider.streamed).toEqual([])
    expect(state.marks).toEqual([{ kind: 'none', id: 'm1' }])
  })

  it('skips a video already looked at, unless forced', async () => {
    await storeVideo(12 * MB)
    state.row = { ...state.row, compactSize: 0 }
    await expect(run(tools(3 * MB))).resolves.toBe('skipped')
    await expect(run(tools(3 * MB), true)).resolves.toBe('made')
  })

  it('skips an image and a file in an older bucket', async () => {
    await storeVideo(12 * MB)
    state.row = { ...state.row, contentType: 'image/png' }
    await expect(run(tools(3 * MB))).resolves.toBe('skipped')
    state.row = { ...state.row, contentType: 'video/mp4', provider: 'r2' }
    await expect(run(tools(3 * MB))).resolves.toBe('skipped')
    expect(state.marks).toEqual([])
  })

  it('marks a video whose file is gone as missing, once, without a retry', async () => {
    state.provider = new MemoryStorageProvider({ publicBaseUrl: 'https://cdn.test' })
    await expect(run(tools(3 * MB))).resolves.toBe('missing')
    expect(state.marks).toEqual([{ kind: 'missing', id: 'm1' }])
    // Marked: the next sweep or plain run leaves it alone.
    state.row = { ...state.row, compactSize: 0, posterMediaId: null, processError: MISSING }
    state.marks = []
    await expect(run(tools(3 * MB))).resolves.toBe('skipped')
    expect(state.marks).toEqual([])
  })

  it('a forced run that finds the file back clears the missing mark', async () => {
    await storeVideo(12 * MB)
    state.row = { ...state.row, compactSize: 0, processError: MISSING }
    await expect(run(tools(3 * MB), true)).resolves.toBe('made')
    expect(state.marks[0]).toEqual({ kind: 'update', id: 'm1', copy: { processError: null } })
  })

  it('fails without marking when ffmpeg fails, so the retry can try again', async () => {
    await storeVideo(12 * MB)
    const t = tools(3 * MB)
    t.encode.mockRejectedValueOnce(new Error('ffmpeg exited 1'))
    await expect(run(t)).rejects.toThrow('ffmpeg exited 1')
    expect(state.marks).toEqual([])
  })
})

describe('downloadToFile', () => {
  it('falls back to a whole read for a provider without streaming', async () => {
    const provider = await storeVideo(1024)
    const plain = { get: provider.get.bind(provider) }
    const path = join(await mkdtemp(join(tmpdir(), 'vt-')), 'in')
    await expect(downloadToFile(plain as never, KEY, path)).resolves.toBe(true)
    expect((await stat(path)).size).toBe(1024)
    await expect(downloadToFile(plain as never, 'missing', path)).resolves.toBe(false)
  })
})

describe('first-frame poster', () => {
  const POSTER_KEY = 'stores/s1/media/hero.poster.webp'
  const posterMark = {
    kind: 'poster',
    id: 'm1',
    copy: {
      url: `https://cdn.test/${POSTER_KEY}`,
      key: POSTER_KEY,
      provider: 'memory',
      size: 40 * 1024,
      width: 1280,
      height: 720,
    },
  }

  it('makes the poster beside the video from the same download, then the copy', async () => {
    const provider = await storeVideo(12 * MB)
    state.row = { ...state.row, posterMediaId: null }
    const t = tools(3 * MB)
    await expect(run(t)).resolves.toBe('made')
    expect(t.poster).toHaveBeenCalledTimes(1)
    expect(provider.streamed).toEqual([POSTER_KEY, 'stores/s1/media/hero.small.mp4'])
    expect(state.marks.map((m) => m.kind)).toEqual(['poster', 'copy'])
    expect(state.marks[0]).toEqual(posterMark)
  })

  it('downloads a small video already looked at for its poster alone', async () => {
    const provider = await storeVideo(2 * MB)
    state.row = { ...state.row, compactSize: 0, posterMediaId: null }
    const t = tools(1 * MB)
    await expect(run(t)).resolves.toBe('poster')
    expect(t.encode).not.toHaveBeenCalled()
    expect(provider.streamed).toEqual([POSTER_KEY])
    expect(state.marks).toEqual([posterMark])
  })

  it('links a poster already in the bucket instead of making it again', async () => {
    const provider = await storeVideo(12 * MB)
    await provider.put({ key: POSTER_KEY, body: new Uint8Array(500), contentType: 'image/webp' })
    state.row = { ...state.row, compactSize: 0, posterMediaId: null }
    const get = vi.spyOn(provider, 'getStream')
    const t = tools(3 * MB)
    await expect(run(t)).resolves.toBe('poster')
    expect(get).not.toHaveBeenCalled()
    expect(t.poster).not.toHaveBeenCalled()
    expect(state.marks).toEqual([
      { kind: 'poster', id: 'm1', copy: expect.objectContaining({ key: POSTER_KEY, size: 500 }) },
    ])
  })

  it('never replaces a poster the video has, even forced', async () => {
    await storeVideo(12 * MB)
    state.row = { ...state.row, compactSize: 0 }
    const t = tools(3 * MB)
    await expect(run(t)).resolves.toBe('skipped')
    await expect(run(t, true)).resolves.toBe('made')
    expect(t.poster).not.toHaveBeenCalled()
  })

  it('a failed frame grab never fails the copy', async () => {
    await storeVideo(12 * MB)
    state.row = { ...state.row, posterMediaId: null }
    const t = tools(3 * MB)
    t.poster.mockRejectedValueOnce(new Error('ffmpeg exited 1'))
    await expect(run(t)).resolves.toBe('made')
    expect(state.marks.map((m) => m.kind)).toEqual(['copy'])
  })
})
