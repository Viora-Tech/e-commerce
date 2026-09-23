import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/** Routes image URLs to PNG bytes and the GraphQL endpoint to `graphql`. */
export function fakeFetch(
  graphql: (query: string, variables: Record<string, unknown>) => Response | Promise<Response>,
  log: FetchLog = [],
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === 'string' ? init.body : null
    log.push({ url, body })
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

export { MemoryStorageProvider }
