import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ported from mochi-dev's service-layer audit. Fails the moment a database
 * statement appears outside src/services. Routers call services; procedures
 * only open the store scope. A query in a router bypasses nothing today, but
 * the rule is what keeps that true as the router count grows.
 */
const SRC = join(import.meta.dirname, '../src')

const QUERY_PATTERN =
  /\b(tx|db|context\.tx|context\.db)\s*\.\s*(select|insert|update|delete|execute|transaction)\s*\(/
const DRIZZLE_TABLE_IMPORT =
  /import\s+\{[^}]*\b(product|variant|order|cart|store|customer|media)\b[^}]*\}\s+from\s+['"]@commerce\/db['"]/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })
}

const files = walk(SRC).map((p) => ({
  name: relative(SRC, p).replaceAll('\\', '/'),
  code: readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''),
}))

describe('SERVICE_LAYER', () => {
  it('finds real files to audit', () => {
    expect(files.some((f) => f.name === 'routers/products.ts')).toBe(true)
  })

  it('no query runs outside src/services', () => {
    const offenders = files
      .filter((f) => !f.name.startsWith('services/'))
      .filter((f) => QUERY_PATTERN.test(f.code))
      .map((f) => f.name)
    expect(offenders, 'Move the query into a src/services/*.service.ts function.').toEqual([])
  })

  it('routers do not import tables', () => {
    const offenders = files
      .filter((f) => f.name.startsWith('routers/'))
      .filter((f) => DRIZZLE_TABLE_IMPORT.test(f.code))
      .map((f) => f.name)
    expect(offenders, 'Routers are thin: call a service.').toEqual([])
  })
})
