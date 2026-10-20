import { CommerceError } from '@commerce/core'
import { type LookupAll, readCapped, safeFetch } from '@commerce/core/safe-fetch'
import type { IndexSettings, ProductDocument } from './documents'

/**
 * A small client for Meilisearch's REST API (https://www.meilisearch.com/docs/reference/api),
 * server side only: it carries the store's keys. `Authorization: Bearer <key>` on every call.
 * Only community-edition (MIT) routes are used: indexes, documents, settings, search, keys,
 * tasks and index swaps; nothing from the Enterprise Edition (sharding, replication).
 *
 * The address is the merchant's, so every call goes through `safeFetch` (public https hosts
 * only, headers never follow a redirect elsewhere) unless the platform listed its origin in
 * `MEILISEARCH_TRUSTED_ORIGINS` (our own Meilisearch on the private network).
 */

export type MeiliErrorCode =
  | 'unauthorized'
  | 'not-found'
  | 'bad-request'
  | 'unreachable'
  | 'bad-response'
  | 'task-failed'

const MESSAGES: Record<MeiliErrorCode, string> = {
  unauthorized:
    'Meilisearch did not accept the key. Use the master key or an admin API key, and paste it again.',
  'not-found': 'Meilisearch has no such index yet. Run Reindex now.',
  'bad-request': 'Meilisearch refused the request. It may be an older version of Meilisearch.',
  unreachable:
    'Could not reach Meilisearch at that address. Check the address and that Meilisearch is running.',
  'bad-response': 'Meilisearch sent an answer we could not read. Check the address points at it.',
  'task-failed': 'Meilisearch could not finish the update.',
}

export class MeiliError extends CommerceError {
  override readonly code: MeiliErrorCode

  constructor(code: MeiliErrorCode, detail?: string) {
    super(code, detail ? `${MESSAGES[code]} ${detail}` : MESSAGES[code])
    this.code = code
  }
}

export type MeiliClientOptions = {
  /** The normalised address (`normaliseMeilisearchHost`). */
  host: string
  apiKey: string
  /** Origins reached with a plain fetch: private network or http allowed. */
  trustedOrigins?: readonly string[] | undefined
  /** Injected in tests. */
  fetch?: typeof fetch | undefined
  /** Injected in tests. */
  lookup?: LookupAll | undefined
  timeoutMs?: number | undefined
}

/** A queued write; Meilisearch applies it in the background. */
export type MeiliTask = { taskUid: number }

export type MeiliTaskStatus = 'enqueued' | 'processing' | 'succeeded' | 'failed' | 'canceled'

/** The most an answer may weigh; a page of ids is a few kilobytes. */
const MAX_BYTES = 5_000_000

/** `MEILISEARCH_TRUSTED_ORIGINS` (comma-separated) as a clean list of origins. */
export function parseTrustedOrigins(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => {
      try {
        return new URL(s.trim()).origin
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const taskOf = (raw: unknown): MeiliTask => {
  if (!isRecord(raw) || typeof raw.taskUid !== 'number') throw new MeiliError('bad-response')
  return { taskUid: raw.taskUid }
}

type SendInit = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal | undefined
  timeoutMs?: number | undefined
}

export function meiliClient(opts: MeiliClientOptions) {
  const base = opts.host.replace(/\/+$/, '')
  const trusted = (opts.trustedOrigins ?? []).includes(new URL(base).origin)
  const doFetch = opts.fetch ?? fetch
  const defaultTimeout = opts.timeoutMs ?? 15_000

  async function send(path: string, init: SendInit = {}): Promise<unknown> {
    const url = `${base}${path}`
    const method = init.method ?? 'GET'
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${opts.apiKey}`,
    }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    const body = init.body === undefined ? undefined : JSON.stringify(init.body)
    const timeoutMs = init.timeoutMs ?? defaultTimeout
    let res: Response
    try {
      if (trusted) {
        const timeout = AbortSignal.timeout(timeoutMs)
        res = await doFetch(url, {
          method,
          headers,
          redirect: 'manual',
          signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
          ...(body === undefined ? {} : { body }),
        })
      } else {
        res = await safeFetch(url, {
          method,
          headers,
          body,
          fetch: doFetch,
          signal: init.signal,
          timeoutMs,
          ...(opts.lookup ? { lookup: opts.lookup } : {}),
        })
      }
    } catch {
      throw new MeiliError('unreachable')
    }
    if (res.status === 401 || res.status === 403) throw new MeiliError('unauthorized')
    if (res.status === 404) throw new MeiliError('not-found')
    const bytes = await readCapped(res, MAX_BYTES).catch(() => null)
    let parsed: unknown = null
    if (bytes?.byteLength) {
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
      } catch {
        throw new MeiliError('bad-response')
      }
    }
    if (res.status === 400) {
      const message = isRecord(parsed) && typeof parsed.message === 'string' ? parsed.message : ''
      throw new MeiliError('bad-request', message.slice(0, 300))
    }
    if (!res.ok) throw new MeiliError(res.status >= 500 ? 'unreachable' : 'bad-response')
    return parsed
  }

  const index = (uid: string) => `/indexes/${encodeURIComponent(uid)}`

  async function getTask(
    taskUid: number,
  ): Promise<{ status: MeiliTaskStatus; error: string | null }> {
    const raw = await send(`/tasks/${taskUid}`)
    if (!isRecord(raw) || typeof raw.status !== 'string') throw new MeiliError('bad-response')
    const error =
      isRecord(raw.error) && typeof raw.error.message === 'string' ? raw.error.message : null
    return { status: raw.status as MeiliTaskStatus, error }
  }

  return {
    /** The server's version; also proves the key may read it. */
    async version(): Promise<string> {
      const raw = await send('/version')
      if (!isRecord(raw) || typeof raw.pkgVersion !== 'string') throw new MeiliError('bad-response')
      return raw.pkgVersion
    },

    /** A key that may only search the given indexes; never expires. */
    async createSearchKey(input: {
      name: string
      indexes: string[]
    }): Promise<{ key: string; uid: string }> {
      const raw = await send('/keys', {
        method: 'POST',
        body: {
          name: input.name,
          description: 'Storefront search, created by the Meilisearch app',
          actions: ['search'],
          indexes: input.indexes,
          expiresAt: null,
        },
      })
      if (!isRecord(raw) || typeof raw.key !== 'string' || typeof raw.uid !== 'string') {
        throw new MeiliError('bad-response')
      }
      return { key: raw.key, uid: raw.uid }
    },

    async deleteKey(uid: string): Promise<void> {
      await send(`/keys/${encodeURIComponent(uid)}`, { method: 'DELETE' })
    },

    async createIndex(uid: string): Promise<MeiliTask> {
      return taskOf(await send('/indexes', { method: 'POST', body: { uid, primaryKey: 'id' } }))
    },

    async deleteIndex(uid: string): Promise<MeiliTask> {
      return taskOf(await send(index(uid), { method: 'DELETE' }))
    },

    async updateSettings(uid: string, settings: IndexSettings): Promise<MeiliTask> {
      return taskOf(await send(`${index(uid)}/settings`, { method: 'PATCH', body: settings }))
    },

    /** Add or replace documents by id. */
    async addDocuments(uid: string, docs: readonly ProductDocument[]): Promise<MeiliTask> {
      return taskOf(
        await send(`${index(uid)}/documents?primaryKey=id`, { method: 'POST', body: docs }),
      )
    },

    async deleteDocuments(uid: string, ids: readonly string[]): Promise<MeiliTask> {
      return taskOf(
        await send(`${index(uid)}/documents/delete-batch`, { method: 'POST', body: ids }),
      )
    },

    /** Swap two indexes' contents and settings in one step (the rebuilt index goes live). */
    async swapIndexes(a: string, b: string): Promise<MeiliTask> {
      return taskOf(await send('/swap-indexes', { method: 'POST', body: [{ indexes: [a, b] }] }))
    },

    async stats(uid: string): Promise<{ documents: number; indexing: boolean }> {
      const raw = await send(`${index(uid)}/stats`)
      if (!isRecord(raw) || typeof raw.numberOfDocuments !== 'number') {
        throw new MeiliError('bad-response')
      }
      return { documents: raw.numberOfDocuments, indexing: raw.isIndexing === true }
    },

    /** Matching product ids, best first. */
    async searchIds(
      uid: string,
      input: { query: string; limit: number; signal?: AbortSignal | undefined },
    ): Promise<string[]> {
      const raw = await send(`${index(uid)}/search`, {
        method: 'POST',
        body: { q: input.query, limit: input.limit, attributesToRetrieve: ['id'] },
        signal: input.signal,
      })
      if (!isRecord(raw) || !Array.isArray(raw.hits)) throw new MeiliError('bad-response')
      return raw.hits.flatMap((h) => (isRecord(h) && typeof h.id === 'string' ? [h.id] : []))
    },

    task: getTask,

    /**
     * Wait for a queued write to finish. Throws `task-failed` with Meilisearch's words when it
     * failed or was cancelled, `unreachable` when it is still going after `timeoutMs`.
     */
    async waitForTask(
      task: MeiliTask,
      wait: { timeoutMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> } = {},
    ): Promise<void> {
      const sleep = wait.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
      const deadline = Date.now() + (wait.timeoutMs ?? 120_000)
      for (;;) {
        const t = await getTask(task.taskUid)
        if (t.status === 'succeeded') return
        if (t.status === 'failed' || t.status === 'canceled') {
          throw new MeiliError('task-failed', t.error ?? '')
        }
        if (Date.now() > deadline) throw new MeiliError('unreachable')
        await sleep(wait.pollMs ?? 250)
      }
    },
  }
}

export type MeiliClient = ReturnType<typeof meiliClient>
