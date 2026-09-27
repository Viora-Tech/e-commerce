import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addMediaProcessJob, type MediaProcessJob, type MediaProcessQueue } from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { MemoryStorageProvider } from '@commerce/storage'
import type { RunDeps } from '../src/run'

export const owner = createDb(process.env.DATABASE_URL_OWNER as string)
export const app = createDb(process.env.DATABASE_URL as string)

export const SECRET = 'test-settings-secret-test-settings-secret'

export const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')

export async function seedStore(slug = 'shop') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

/** A one-pixel PNG, what every mocked image download returns. */
export const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

export type FetchLog = { url: string; body: string | null }[]

/** A fake `/admin/oauth/access_token` responder: always issues the same fresh token. */
export const OAUTH_TOKEN = 'shpca_fake-access-token'
export function oauthSuccess(expiresInSeconds = 86399): Response {
  return json({ access_token: OAUTH_TOKEN, expires_in: expiresInSeconds, scope: 'read_products' })
}

/**
 * Routes image URLs to PNG bytes, the GraphQL endpoint to `graphql`, and the
 * client-credentials token endpoint to `oauth` (defaults to always succeeding).
 */
export function fakeFetch(
  graphql: (query: string, variables: Record<string, unknown>) => Response | Promise<Response>,
  log: FetchLog = [],
  oauth: (body: URLSearchParams) => Response | Promise<Response> = () => oauthSuccess(),
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === 'string' ? init.body : null
    log.push({ url, body })
    if (url.endsWith('/admin/oauth/access_token')) {
      return oauth(new URLSearchParams(body ?? ''))
    }
    if (url.endsWith('/graphql.json')) {
      const parsed = JSON.parse(body ?? '{}') as {
        query: string
        variables: Record<string, unknown>
      }
      return graphql(parsed.query, parsed.variables ?? {})
    }
    if (url.includes('missing')) return new Response('nope', { status: 404 })
    return new Response(PNG, { headers: { 'content-type': 'image/png' } })
  }) as typeof fetch
}

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  })

export function deps(
  storeId: string,
  storage: MemoryStorageProvider,
  extra: Partial<RunDeps> = {},
): RunDeps {
  return {
    storeId,
    inStore: (fn) => withStore(app, storeId, fn),
    storage: async () => storage,
    settingsSecret: SECRET,
    log: () => {},
    ...extra,
  }
}

/**
 * Stands in for the BullMQ media-processing queue. `adds` records every call;
 * `jobs` keeps one entry per job id, the way BullMQ ignores a repeat id.
 * `failing` makes every add throw, like an unreachable Redis.
 */
export function fakeMediaQueue(opts: { failing?: boolean } = {}) {
  const adds: { data: MediaProcessJob; jobId: string | undefined }[] = []
  const jobs = new Map<string, MediaProcessJob>()
  const queue: MediaProcessQueue = {
    async add(_name, data, jobOpts) {
      if (opts.failing) throw new Error('connect ECONNREFUSED 127.0.0.1:6379')
      adds.push({ data, jobId: jobOpts?.jobId })
      const id = jobOpts?.jobId ?? `${adds.length}`
      if (!jobs.has(id)) jobs.set(id, data)
    },
  }
  const processMedia = (storeId: string) => (mediaId: string) =>
    addMediaProcessJob(queue, { storeId, mediaId })
  return { queue, adds, jobs, processMedia }
}

export { MemoryStorageProvider }
