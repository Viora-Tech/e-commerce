/**
 * Sweep: a storefront server action never takes the store id from its caller (security audit
 * D-13). Every export of a `'use server'` file is an endpoint the browser can call with any
 * arguments, and a bound argument round-trips through the browser too, so the store must come
 * from the request's hostname (`requestStoreId()` / `x-store-id`, set by `proxy.ts`). Not a
 * ratchet: there are no exceptions.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listFiles, toRel } from './walk'

const STORE_PARAM = /^export\s+async\s+function\s+(\w+)\s*\(\s*(storeId|_storeId|bound|store)\s*[:,)]/gm

function offenders(source: string): string[] {
  return [...source.matchAll(STORE_PARAM)].map((m) => `${m[1]}(${m[2]})`)
}

describe('sweep: storefront-action-store', () => {
  it('spots an action whose first parameter is a store id', () => {
    expect(offenders("export async function addLineAction(\n  storeId: string,\n  id: string,\n) {}")).toEqual([
      'addLineAction(storeId)',
    ])
    expect(offenders('export async function subscribeAction(bound: string, form: FormData) {}')).toEqual([
      'subscribeAction(bound)',
    ])
    expect(offenders('export async function addLineAction(variantId: string) {}')).toEqual([])
  })

  it('no storefront server action takes a store id from its caller', async () => {
    const files = (await listFiles(['apps/storefront/src'])).filter((f) =>
      /^['"]use server['"]/m.test(readFileSync(f, 'utf8')),
    )
    expect(files.length).toBeGreaterThan(5)
    const hits = files.flatMap((f) =>
      offenders(readFileSync(f, 'utf8')).map((o) => `${toRel(f)}: ${o}`),
    )
    expect(hits, `resolve the store from the hostname instead: ${hits.join(', ')}`).toEqual([])
  })
})
