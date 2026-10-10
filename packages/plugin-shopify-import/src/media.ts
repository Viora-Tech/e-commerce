/**
 * Re-host source images in the store's own storage provider. Each source URL
 * is downloaded once per store: the import mapping (resource `media`, keyed by
 * the URL without its `?v=` query) points at our media row thereafter.
 *
 * Every copy ends: each attempt has an overall deadline and an idle one (no bytes
 * for a while), a passing failure is tried again a couple of times, and what still
 * fails throws so the writer records an issue "Retry the ones that were missed"
 * picks up. A hung download or bucket can never hold a slot for good.
 */
import { CommerceError } from '@commerce/core'
import { BlockedUrlError, type LookupAll, safeFetch } from '@commerce/core/safe-fetch'
import { media, newId } from '@commerce/db'
import {
  isAllowedContentType,
  isImageContentType,
  mediaKey,
  type StorageProvider,
} from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { createByteBudget, createLimiter } from './concurrency'
import { BUFFER_BUDGET_BYTES, importMaxBytesFor, sizeText } from './limits'
import { metered, peek, readAll, sniffContentType } from './media-streams'
import { findMapping, type InStore, type MediaHost, saveMapping } from './runtime'

/**
 * Copies in flight across one import (every product's images and the Files step
 * share it). What a copy holds in memory is bounded separately: whole-read copies
 * (images, up to 50 MB) by the byte budget, streamed videos by `STREAMED_IN_FLIGHT`.
 */
const MEDIA_IN_FLIGHT = 16
/** Videos streaming into the bucket at once (each holds up to ~16 MB of parts). */
const STREAMED_IN_FLIGHT = 4

/** One attempt at an image or other small copy, from asking to stored. */
const COPY_TIMEOUT_MS = 60_000
/** One attempt at a streamed video (up to 1 GB), from asking to stored. */
const LARGE_COPY_TIMEOUT_MS = 30 * 60_000
/** A download that sends nothing for this long is given up on, whatever its size. */
const IDLE_TIMEOUT_MS = 30_000
/** Extra attempts after a timeout, a dropped connection or a server error; then it is an issue. */
const COPY_RETRIES = 2
const BACKOFF_MS = [1000, 3000]

/**
 * A copy that would fail the same way again: not found, too large, a type we do
 * not take. Not retried (nor is a refused address, `BlockedUrlError`).
 */
class CopyRefused extends CommerceError {
  constructor(message: string) {
    super('COPY_REFUSED', message)
  }
}

/** A deadline of this attempt passed. */
class CopyTimeout extends CommerceError {
  constructor(message: string) {
    super('COPY_TIMEOUT', message)
  }
}

const seconds = (ms: number) => `${ms / 1000} s`

function isRetryable(err: unknown): boolean {
  return !(err instanceof CopyRefused || err instanceof BlockedUrlError)
}

type AttemptClock = ReturnType<typeof attemptClock>

/** An object in the bucket, waiting for its media row. */
type Stored = {
  id: string
  store: StorageProvider
  objectKey: string
  contentType: string
  size: number
}

/**
 * The deadlines of one attempt: an overall one (made longer once a video starts
 * streaming) and an idle one, restarted by every chunk. Either aborts `signal`,
 * which ends the download and the write, and rejects `aborted` so the attempt
 * settles even if something ignores the signal.
 */
function attemptClock(opts: { overallMs: number; idleMs: number; run?: AbortSignal | undefined }) {
  const own = new AbortController()
  const signal = opts.run ? AbortSignal.any([own.signal, opts.run]) : own.signal
  const fire = (message: string) => own.abort(new CopyTimeout(message))
  let overall = setTimeout(() => fire(`timed out after ${seconds(opts.overallMs)}`), opts.overallMs)
  let idle: ReturnType<typeof setTimeout> | undefined
  const kick = () => {
    clearTimeout(idle)
    idle = setTimeout(() => fire(`timed out: no data for ${seconds(opts.idleMs)}`), opts.idleMs)
  }
  const aborted = new Promise<never>((_, reject) => {
    const fail = () =>
      reject(signal.reason instanceof Error ? signal.reason : new Error('the copy was stopped'))
    if (signal.aborted) fail()
    else signal.addEventListener('abort', fail, { once: true })
  })
  // Nobody may be listening when the attempt already ended another way.
  aborted.catch(() => {})
  kick()
  let overallMs = opts.overallMs
  const extend = (ms: number) => {
    overallMs = ms
    clearTimeout(overall)
    overall = setTimeout(() => fire(`timed out after ${seconds(ms)}`), ms)
  }
  return {
    signal,
    /** A chunk arrived: the idle deadline starts again. */
    kick,
    /** Give this attempt `ms` in all from now (a video). */
    extend,
    /**
     * Waiting for its turn (memory budget, stream slots) is not the source being
     * slow: no deadline runs until `resume`, which starts both again in full.
     */
    pause() {
      clearTimeout(overall)
      clearTimeout(idle)
    },
    resume() {
      extend(overallMs)
      kick()
    },
    aborted,
    stop() {
      clearTimeout(overall)
      clearTimeout(idle)
    },
  }
}

/** `//cdn.shopify.com/a.jpg?v=12` → `https://cdn.shopify.com/a.jpg`. */
export function mediaSourceKey(src: string): string {
  const absolute = src.startsWith('//') ? `https:${src}` : src
  return absolute.split(/[?#]/)[0] ?? absolute
}

function filenameOf(url: string): string {
  const last = url.split('/').pop() ?? 'image'
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

export type MediaHostOptions = {
  storeId: string
  inStore: InStore
  storage: () => Promise<StorageProvider>
  fetch?: typeof fetch
  /** DNS for the SSRF check (`@commerce/core/safe-fetch`); tests inject a fake. */
  lookup?: LookupAll
  /** One attempt at a small copy, in all (`COPY_TIMEOUT_MS`). */
  timeoutMs?: number | undefined
  /** One attempt at a streamed video, in all (`LARGE_COPY_TIMEOUT_MS`). */
  largeTimeoutMs?: number | undefined
  /** No bytes for this long ends the attempt (`IDLE_TIMEOUT_MS`). */
  idleTimeoutMs?: number | undefined
  /** Extra attempts after a passing failure (`COPY_RETRIES`). */
  retries?: number | undefined
  /** Waits between attempts; tests pass one that returns at once. */
  sleep?: ((ms: number) => Promise<void>) | undefined
  /** The run stopping: every copy in flight ends with its reason. */
  signal?: AbortSignal | undefined
  /** Bytes moved (any copy): the run's proof that it is getting somewhere. */
  onActivity?: (() => void) | undefined
  /** One copy finished: stored (`true`) or given up on (`false`). */
  onSettled?: ((ok: boolean) => void) | undefined
  /**
   * Called once per newly hosted image, after its row is written, so the
   * caller can queue it for the upload-time pipeline (see
   * `@commerce/core/media-pipeline`) the same way `mediaRouter.confirm` does
   * for a direct upload. Never called for a source already mapped (a re-run,
   * or the same image on two products) or for video, which is stored `ready`.
   * Runs inside `host`, so it shares the caller's download concurrency. An
   * import run without this wired up leaves the row `processing` for `bun run
   * media:reprocess` to pick up later, same as any other stuck row.
   */
  onMediaImported?: (mediaId: string, contentType: string, src: string) => Promise<void>
  /** Overrides `MEDIA_IN_FLIGHT` (tests). */
  maxInFlight?: number | undefined
  /** Overrides `BUFFER_BUDGET_BYTES`: bytes of whole-read copies held at once. */
  bufferBudgetBytes?: number | undefined
}

export function createMediaHost(opts: MediaHostOptions): MediaHost {
  const known = new Map<string, string>()
  let provider: StorageProvider | null = null
  const inFlight = createLimiter(opts.maxInFlight ?? MEDIA_IN_FLIGHT)
  const budget = createByteBudget(opts.bufferBudgetBytes ?? BUFFER_BUDGET_BYTES)
  const streamed = createLimiter(STREAMED_IN_FLIGHT)
  const smallMs = opts.timeoutMs ?? COPY_TIMEOUT_MS
  const largeMs = opts.largeTimeoutMs ?? LARGE_COPY_TIMEOUT_MS
  const idleMs = opts.idleTimeoutMs ?? IDLE_TIMEOUT_MS
  const retries = opts.retries ?? COPY_RETRIES
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  return {
    async urlOf(mediaId) {
      const [row] = await opts.inStore((tx) =>
        tx.select({ url: media.url }).from(media).where(eq(media.id, mediaId)),
      )
      return row?.url ?? null
    },

    async host(src, alt) {
      const key = mediaSourceKey(src)
      const cached = known.get(key)
      if (cached) return cached
      const existing = await opts.inStore(async (tx) => {
        const id = await findMapping(tx, 'media', key)
        if (!id) return null
        const [row] = await tx.select({ id: media.id }).from(media).where(eq(media.id, id))
        if (row && alt) await tx.update(media).set({ alt }).where(eq(media.id, id))
        return row?.id ?? null
      })
      if (existing) {
        known.set(key, existing)
        return existing
      }

      return inFlight(() => copyWithRetries(key, alt))
    },
  }

  /**
   * Copy one source, again after a timeout, a dropped connection or a server
   * error (`COPY_RETRIES` more times, waiting a little longer each time). What
   * still fails throws; the writer records it as an issue the merchant can retry.
   */
  async function copyWithRetries(key: string, alt: string | null): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try {
        const id = await copyOnce(key, alt)
        opts.onSettled?.(true)
        return id
      } catch (err) {
        if (!opts.signal?.aborted && isRetryable(err) && attempt < retries) {
          await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 1000)
          continue
        }
        opts.onSettled?.(false)
        if (attempt === 0 || !(err instanceof Error)) throw err
        throw new Error(`${err.message} (tried ${attempt + 1} times)`, { cause: err })
      }
    }
  }

  /**
   * One attempt, bounded by its deadlines: whatever the download or the bucket
   * do, this settles, so the slot it holds is always given back.
   */
  async function copyOnce(key: string, alt: string | null): Promise<string> {
    const clock = attemptClock({ overallMs: smallMs, idleMs, run: opts.signal })
    let stored: Stored
    try {
      stored = await Promise.race([transfer(key, clock), clock.aborted])
    } finally {
      clock.stop()
    }
    // Only a stored object gets its row, so a timed-out attempt never leaves one behind.
    const { id, store, objectKey, contentType, size } = stored
    // Imported images still go through the pipeline (strip EXIF/GPS, generate
    // AVIF/WebP variants) — Shopify's own CDN copy is not something this
    // platform controls, so it gets the same treatment as a direct upload.
    const needsPipeline = isImageContentType(contentType)
    await opts.inStore(async (tx) => {
      await tx.insert(media).values({
        id,
        storeId: opts.storeId,
        url: store.publicUrl(objectKey),
        key: objectKey,
        provider: store.id,
        contentType,
        size,
        alt: alt || null,
        status: needsPipeline ? 'processing' : 'ready',
      })
      await saveMapping(tx, opts.storeId, 'media', key, id)
    })
    if (needsPipeline) await opts.onMediaImported?.(id, contentType, key)
    known.set(key, id)
    return id
  }

  /** Download one source and store it: a video streamed when the bucket can take a stream. */
  async function transfer(key: string, clock: AttemptClock): Promise<Stored> {
    const onChunk = () => {
      clock.kick()
      opts.onActivity?.()
    }
    // Source URLs come from a CSV or product HTML: only public hosts, every
    // redirect re-checked, bytes capped while streaming. Merchant CSVs may
    // still carry http:// image links, so http is allowed (address checks hold).
    const res = await safeFetch(key, {
      allowHttp: true,
      timeoutMs: Math.max(smallMs, largeMs),
      signal: clock.signal,
      ...(opts.fetch ? { fetch: opts.fetch } : {}),
      ...(opts.lookup ? { lookup: opts.lookup } : {}),
    })
    onChunk()
    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      const message = `download failed (${res.status})`
      // Not found, forbidden and the like answer the same next time; 408, 429 and 5xx may not.
      const passing = res.status === 408 || res.status === 429 || res.status >= 500
      throw passing ? new Error(message) : new CopyRefused(message)
    }
    const declaredType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    const trusted = declaredType && isAllowedContentType(declaredType) ? declaredType : null
    // fetch decompresses gzip/br but leaves the compressed length in the header: the
    // length is only a hint for refusing early, and only when nothing was encoded.
    const encoding = res.headers.get('content-encoding')?.trim().toLowerCase()
    const declaredSize =
      encoding && encoding !== 'identity'
        ? Number.NaN
        : Number(res.headers.get('content-length') ?? Number.NaN)
    provider ??= await opts.storage()
    const store = provider
    const id = newId()
    const keyFor = (contentType: string) =>
      mediaKey({ storeId: opts.storeId, filename: filenameOf(key), contentType, id })
    const tooLarge = (limit: number) => new CopyRefused(`file is larger than ${sizeText(limit)}`)

    // The type: the header when it is one we take, else what the first bytes say.
    let body: ReadableStream<Uint8Array> | null = res.body
    let contentType = trusted
    if (!contentType) {
      const peeked = body ? await peek(body, onChunk) : null
      body = peeked?.body ?? null
      contentType =
        (peeked ? sniffContentType(peeked.head) : null) ??
        declaredType ??
        'application/octet-stream'
      if (!isAllowedContentType(contentType)) {
        await body?.cancel().catch(() => {})
        throw new CopyRefused(`${contentType} is not supported`)
      }
    }
    const type = contentType
    const streams = !isImageContentType(type) && Boolean(store.putStream) && body !== null
    const limit = importMaxBytesFor(type, streams)
    if (Number.isFinite(declaredSize) && declaredSize > limit) {
      await body?.cancel().catch(() => {})
      throw tooLarge(limit)
    }
    const objectKey = keyFor(type)

    if (streams && store.putStream && body) {
      // A video: from the download into the bucket in parts, never held whole. Its
      // size is what actually arrived; one smaller than a part goes as one exact PUT.
      const putStream = store.putStream.bind(store)
      const source = body
      let counted = 0
      clock.pause()
      await streamed(() => {
        clock.resume()
        clock.extend(largeMs)
        return putStream({
          key: objectKey,
          body: metered(
            source,
            limit,
            (n) => {
              counted += n
              onChunk()
            },
            () => tooLarge(limit),
          ),
          contentType: type,
          signal: clock.signal,
        })
      })
      return { id, store, objectKey, contentType: type, size: counted }
    }

    // An image (50 MB cap), or a video the storage cannot take as a stream: read it
    // whole and store it with one put of its exact length. The bytes it may hold
    // (its stated size, else the cap) are reserved first and kept until it is stored.
    const expected = Number.isFinite(declaredSize) ? declaredSize : null
    const source = body
    clock.pause()
    const readAndPut = async () => {
      const bytes = await readAll(source, limit, onChunk, expected)
      if (!bytes) throw tooLarge(limit)
      await store.put({ key: objectKey, body: bytes, contentType: type, signal: clock.signal })
      return bytes.byteLength
    }
    const size = await budget.use(
      expected ?? limit,
      () => {
        clock.resume()
        // The reservation goes back when the attempt ends, even if a hung source ignores the abort.
        return Promise.race([readAndPut(), clock.aborted])
      },
      clock.signal,
    )
    return { id, store, objectKey, contentType: type, size }
  }
}
