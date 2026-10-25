/**
 * Sweep: turbo's test/typecheck cache must see every file a task depends on.
 *
 * `packages/core` imports the root `commerce.config.ts` (and the admin imports
 * `commerce.blocks.config.ts`), which pull in every plugin package — packages that core
 * does NOT list in its package.json, so turbo's dependency graph can't see them. The root
 * `//#plugin-graph` task in turbo.json closes that gap: its hash covers both config files
 * and every package they import, and each package that depends on core adds it to its
 * `test` and `typecheck` dependsOn (in its own turbo.json). Without this, editing a plugin
 * would replay a stale cached pass for core, the API and the apps.
 *
 * Fix a failure by adding the missing `<package>#build` to `//#plugin-graph`, or by
 * giving the package a turbo.json like `packages/core/turbo.json`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './walk'

const CONFIG_FILES = ['commerce.config.ts', 'commerce.blocks.config.ts']
const CACHED_TASKS = ['test', 'typecheck'] as const

type Manifest = {
  name: string
  dir: string
  deps: string[]
  scripts: Record<string, string>
}

type TurboTask = { dependsOn?: string[] }

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')) as T
}

function workspaces(): Manifest[] {
  const out: Manifest[] = []
  for (const group of ['apps', 'packages']) {
    for (const entry of readdirSync(path.join(ROOT, group))) {
      const rel = `${group}/${entry}/package.json`
      if (!existsSync(path.join(ROOT, rel))) continue
      const pj = readJson<{
        name: string
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
        scripts?: Record<string, string>
      }>(rel)
      const deps = Object.keys({ ...pj.dependencies, ...pj.devDependencies })
      out.push({
        name: pj.name,
        dir: `${group}/${entry}`,
        deps: deps.filter((d) => d.startsWith('@commerce/')),
        scripts: pj.scripts ?? {},
      })
    }
  }
  return out
}

function dependsOnCore(name: string, byName: Map<string, Manifest>, seen = new Set<string>()) {
  if (name === '@commerce/core') return true
  if (seen.has(name)) return false
  seen.add(name)
  return (byName.get(name)?.deps ?? []).some((d) => dependsOnCore(d, byName, seen))
}

describe('sweep: turbo-cache-graph', () => {
  it('//#plugin-graph lists exactly the packages the root commerce configs import', () => {
    const imported = new Set<string>()
    for (const file of CONFIG_FILES) {
      const source = readFileSync(path.join(ROOT, file), 'utf8')
      for (const [, spec] of source.matchAll(/from '(@commerce\/[^/']+)[^']*'/g)) {
        imported.add(`${spec}#build`)
      }
    }
    const turbo = readJson<{ tasks: Record<string, TurboTask> }>('turbo.json')
    const listed = new Set(turbo.tasks['//#plugin-graph']?.dependsOn ?? [])
    expect([...imported].filter((t) => !listed.has(t)).sort(), 'missing').toEqual([])
    expect([...listed].filter((t) => !imported.has(t)).sort(), 'stale').toEqual([])
  })

  it('every package that depends on core hashes //#plugin-graph for test and typecheck', () => {
    const all = workspaces()
    const byName = new Map(all.map((m) => [m.name, m]))
    const missing: string[] = []
    for (const pkg of all) {
      if (!dependsOnCore(pkg.name, byName)) continue
      const rel = `${pkg.dir}/turbo.json`
      const tasks = existsSync(path.join(ROOT, rel))
        ? readJson<{ tasks?: Record<string, TurboTask> }>(rel).tasks
        : undefined
      for (const task of CACHED_TASKS) {
        if (!pkg.scripts[task]) continue
        if (!tasks?.[task]?.dependsOn?.includes('//#plugin-graph')) missing.push(`${rel} → ${task}`)
      }
    }
    expect(missing).toEqual([])
  })
})
