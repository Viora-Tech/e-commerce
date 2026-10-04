/**
 * Preview snapshots: a preview keeps what it read from Shopify (the normalised
 * items the writers consume, gzipped JSONL per resource in the store's private
 * storage) so the import that follows within 24 hours reads that copy and asks
 * Shopify only for what changed since (`updated_at:>'…'`), merged by Shopify id
 * with the newer copy winning. The import deletes the snapshot when it finishes;
 * anything left behind is removed after 7 days (`cleanupSnapshots`, run by the
 * worker's scheduled job and at the start of every run).
 *
 * Memory: items are never all held at once. Recording gzips each batch as it
 * passes (only the compressed bytes stay until the upload); reading
 * decompresses and parses line by line, handing on a batch at a time. Only
 * the changes since the preview (usually few) are held whole, to merge.
 */
import { Readable } from 'node:stream'
import { createGunzip, createGzip } from 'node:zlib'
import type { StorageProvider } from '@commerce/storage'
import { and, eq, isNotNull, lt } from 'drizzle-orm'
import {
  type ImportSnapshot,
  SNAPSHOT_FRESH_MS,
  SNAPSHOT_KEEP_MS,
  type SnapshotResource,
  type SnapshotUse,
} from './client'
import { errorMessage, type InStore } from './runtime'
import { importRun } from './schema'

/** Shopify's clock and ours may disagree a little; ask for changes from a minute earlier. */
const CLOCK_SKEW_MS = 60_000
/** Items per batch handed to the writers when read from a snapshot (the bulk readers' size). */
const BATCH = 50

const snapshotKey = (storeId: string, runId: string, resource: SnapshotResource) =>
  `stores/${storeId}/private/imports/${runId}/snapshot/${resource}.jsonl.gz`

/** Gzip JSONL written batch by batch; only the compressed bytes are kept. */
function gzipWriter() {
  const gzip = createGzip()
  const chunks: Buffer[] = []
  gzip.on('data', (c: Buffer) => chunks.push(c))
  const ended = new Promise<void>((resolve, reject) => {
    gzip.on('end', resolve)
    gzip.on('error', reject)
  })
  return {
    write: (items: readonly unknown[]) =>
      new Promise<void>((resolve, reject) => {
        if (items.length === 0) return resolve()
        const text = `${items.map((item) => JSON.stringify(item)).join('\n')}\n`
        gzip.write(text, (err) => (err ? reject(err) : resolve()))
      }),
    finish: async (): Promise<Uint8Array> => {
      gzip.end()
      await ended
      return new Uint8Array(Buffer.concat(chunks))
    },
  }
}

/** Decompress and parse gzipped JSONL one line at a time. */
async function* readJsonl<T>(bytes: Uint8Array): AsyncGenerator<T> {
  const lines = Readable.from([Buffer.from(bytes)]).pipe(createGunzip())
  lines.setEncoding('utf8')
  let buffer = ''
  for await (const chunk of lines as AsyncIterable<string>) {
    buffer += chunk
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) yield JSON.parse(line) as T
      newline = buffer.indexOf('\n')
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as T
}

/** The search Shopify answers with only what changed after the snapshot. */
const changedSince = (takenAt: string) =>
  `updated_at:>'${new Date(new Date(takenAt).getTime() - CLOCK_SKEW_MS).toISOString()}'`

/** A snapshot the import may use: under 24 hours old. */
export function freshSnapshot(
  snapshot: ImportSnapshot | null | undefined,
  now = Date.now(),
): ImportSnapshot | null {
  if (!snapshot) return null
  const age = now - new Date(snapshot.takenAt).getTime()
  return age >= 0 && age < SNAPSHOT_FRESH_MS ? snapshot : null
}

type SessionOptions = {
  storeId: string
  runId: string
  storage: () => Promise<StorageProvider>
  log: (message: string) => void
  /** `record` on a preview, `reuse` on an import with a fresh snapshot, else `off`. */
  mode:
    | { kind: 'record'; takenAt: Date }
    | { kind: 'reuse'; snapshot: ImportSnapshot }
    | { kind: 'off' }
  /** Called after each resource read from the snapshot, so the run page can say so while it runs. */
  onReuse?: ((use: SnapshotUse) => Promise<void>) | undefined
}

type ReadSpec<T> = {
  resource: SnapshotResource
  idOf: (item: T) => string
  /** Everything, the way a run without a snapshot reads it. */
  full: () => AsyncGenerator<T[]>
  /** Only what matches the search. */
  delta: (search: string) => AsyncGenerator<T[]>
  /**
   * Freshen what a snapshot cannot know (products' stock): read once before
   * the first batch, then applied to each batch in place. A failure means the
   * resource is read from Shopify in full instead.
   */
  refresher?: (() => Promise<(items: T[]) => void>) | undefined
}

/** One run's view of snapshots: records them on a preview, reads them on an import. */
export class SnapshotSession {
  readonly recorded: ImportSnapshot['streams'] = {}
  private changes = 0
  private readonly reused: SnapshotResource[] = []

  constructor(private readonly opts: SessionOptions) {}

  /** What this import took from the preview, or null when it read Shopify for everything. */
  get use(): SnapshotUse | null {
    const { mode } = this.opts
    if (mode.kind !== 'reuse' || this.reused.length === 0) return null
    return { takenAt: mode.snapshot.takenAt, changes: this.changes, reused: [...this.reused] }
  }

  get takenAt(): string | null {
    return this.opts.mode.kind === 'record' ? this.opts.mode.takenAt.toISOString() : null
  }

  async *read<T>(spec: ReadSpec<T>): AsyncGenerator<T[]> {
    const { mode } = this.opts
    if (mode.kind === 'record') {
      yield* this.record(spec)
      return
    }
    const entry = mode.kind === 'reuse' ? mode.snapshot.streams[spec.resource] : undefined
    if (mode.kind !== 'reuse' || !entry) {
      yield* spec.full()
      return
    }
    const bytes = await this.load(entry.key)
    if (!bytes) {
      this.opts.log(`preview copy of ${spec.resource} is gone; reading Shopify again`)
      yield* spec.full()
      return
    }
    let apply: ((items: T[]) => void) | null = null
    if (spec.refresher) {
      try {
        apply = await spec.refresher()
      } catch (err) {
        this.opts.log(
          `could not refresh ${spec.resource} from Shopify (${errorMessage(err)}); reading them again`,
        )
        yield* spec.full()
        return
      }
    }
    // What changed since the preview, by id: the only part held whole.
    const changed = new Map<string, T>()
    for await (const batch of spec.delta(changedSince(mode.snapshot.takenAt))) {
      for (const item of batch) changed.set(spec.idOf(item), item)
    }
    this.changes += changed.size
    this.reused.push(spec.resource)
    this.opts.log(
      `${spec.resource}: ${entry.count} from the preview, ${changed.size} changed since`,
    )
    const use = this.use
    if (use && this.opts.onReuse) await this.opts.onReuse(use)

    const hand = (items: T[]) => {
      apply?.(items)
      return items
    }
    let batch: T[] = []
    for await (const saved of readJsonl<T>(bytes)) {
      const id = spec.idOf(saved)
      const newer = changed.get(id)
      changed.delete(id)
      batch.push(newer ?? saved)
      if (batch.length >= BATCH) {
        yield hand(batch)
        batch = []
      }
    }
    // Records created since the preview.
    for (const item of changed.values()) {
      batch.push(item)
      if (batch.length >= BATCH) {
        yield hand(batch)
        batch = []
      }
    }
    if (batch.length) yield hand(batch)
  }

  private async *record<T>(spec: ReadSpec<T>): AsyncGenerator<T[]> {
    const out = gzipWriter()
    let count = 0
    for await (const batch of spec.full()) {
      await out.write(batch)
      count += batch.length
      yield batch
    }
    const key = snapshotKey(this.opts.storeId, this.opts.runId, spec.resource)
    try {
      const provider = await this.opts.storage()
      await provider.put({ key, body: await out.finish(), contentType: 'application/gzip' })
      this.recorded[spec.resource] = { key, count }
    } catch (err) {
      // The preview still counts; the import just reads Shopify again for this resource.
      this.opts.log(`could not keep the preview of ${spec.resource}: ${errorMessage(err)}`)
    }
  }

  private async load(key: string): Promise<Uint8Array | null> {
    try {
      return await (await this.opts.storage()).get(key)
    } catch (err) {
      this.opts.log(`could not read the preview copy ${key}: ${errorMessage(err)}`)
      return null
    }
  }
}

type CleanupDeps = { inStore: InStore; storage: () => Promise<StorageProvider> }

async function deleteFiles(deps: CleanupDeps, snapshot: ImportSnapshot | null) {
  const keys = Object.values(snapshot?.streams ?? {}).map((s) => s.key)
  if (keys.length === 0) return
  const provider = await deps.storage()
  for (const key of keys) await provider.delete(key)
}

/** Delete one run's snapshot files and clear it from the row. */
export async function dropSnapshot(
  deps: CleanupDeps,
  runId: string,
  snapshot: ImportSnapshot | null,
): Promise<void> {
  await deleteFiles(deps, snapshot)
  await deps.inStore((tx) =>
    tx
      .update(importRun)
      .set({ snapshot: null, snapshotTakenAt: null })
      .where(eq(importRun.id, runId)),
  )
}

/** Remove this store's snapshots taken more than 7 days before `now`. Returns how many went. */
export async function cleanupSnapshots(deps: CleanupDeps, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SNAPSHOT_KEEP_MS)
  const stale = await deps.inStore((tx) =>
    tx
      .select({ id: importRun.id, snapshot: importRun.snapshot })
      .from(importRun)
      .where(and(isNotNull(importRun.snapshotTakenAt), lt(importRun.snapshotTakenAt, cutoff))),
  )
  for (const run of stale) await dropSnapshot(deps, run.id, run.snapshot)
  return stale.length
}
