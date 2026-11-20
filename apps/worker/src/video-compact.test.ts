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
}))

vi.mock('@commerce/db', () => ({
  media: { id: 'id' },
  withStore: async (_db: unknown, _storeId: string, fn: (tx: unknown) => unknown) =>
    fn({ select: () => ({ from: () => ({ where: async () => (state.row ? [state.row] : []) }) }) }),
}))
vi.mock('@commerce/core/registries', () => ({ registriesForStore: async () => ({ storage: {} }) }))
vi.mock('@commerce/core', async () => {
  const rules = await vi.importActual<
    typeof import('../../../packages/core/src/media/compact-video')
  >('../../../packages/core/src/media/compact-video')
  return {
    compactPlan: rules.compactPlan,
    compactVideoKey: rules.compactVideoKey,
    isCompactableVideo: rules.isCompactableVideo,
    worthKeeping: rules.worthKeeping,
    storageForStore: async () => state.provider,
    markVideoCompact: async (_tx: unknown, id: string, copy: unknown) => {
      state.marks.push({ kind: 'copy', id, copy })
    },
    markVideoNoCopy: async (_tx: unknown, id: string) => {
      state.marks.push({ kind: 'none', id })
    },
  }
})

const { compactVideo, downloadToFile } = await import('./video-compact')

const MB = 1024 * 1024
const KEY = 'stores/s1/media/hero.mp4'

async function storeVideo(bytes: number) {
  const provider = new MemoryStorageProvider({ publicBaseUrl: 'https://cdn.test' })
  state.provider = provider
  await provider.put({ key: KEY, body: new Uint8Array(bytes), contentType: 'video/mp4' })
  return provider
}

/** A stand-in for ffmpeg: ffprobe answers `probe`, the encode writes a copy of `copyBytes`. */
function tools(copyBytes: number, probe = { width: 1920, durationSec: 20 }) {
  return {
    probe: vi.fn(async () => probe),
    encode: vi.fn(async (_in: string, out: string) => writeFile(out, new Uint8Array(copyBytes))),
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
  }
  state.marks = []
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
