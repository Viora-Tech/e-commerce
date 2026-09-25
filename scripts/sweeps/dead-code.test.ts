/**
 * Sweep: things that were deliberately removed must not come back. Unlike the other
 * sweeps this isn't a ratchet against new violations — it's a fixed REMOVED list that
 * should stay empty of matches forever. Add to it whenever something is intentionally
 * deleted and could plausibly be reintroduced (a merge, a revert, copy-pasted code).
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './walk'

const REMOVED_PATHS = [
  'apps/admin/src/components/home/india-order-map.tsx',
  'apps/admin/src/data/india-map.ts',
]

const REMOVED_DEPENDENCIES = ['@svg-maps/india', '@measured/puck']

describe('sweep: dead-code', () => {
  it('removed files have not come back', () => {
    const present = REMOVED_PATHS.filter((p) => existsSync(path.join(ROOT, p)))
    expect(present, `removed files reintroduced: ${present.join(', ')}`).toEqual([])
  })

  it('removed dependencies have not come back in any package.json', () => {
    const manifests = [
      'package.json',
      ...['admin', 'storefront', 'worker'].map((a) => `apps/${a}/package.json`),
    ]
    const hits: string[] = []
    for (const rel of manifests) {
      const full = path.join(ROOT, rel)
      if (!existsSync(full)) continue
      const pj = JSON.parse(readFileSync(full, 'utf8'))
      const deps = { ...pj.dependencies, ...pj.devDependencies }
      for (const dep of REMOVED_DEPENDENCIES) {
        if (dep in deps) hits.push(`${rel}: ${dep}`)
      }
    }
    expect(hits, `removed dependencies reintroduced: ${hits.join(', ')}`).toEqual([])
  })
})
