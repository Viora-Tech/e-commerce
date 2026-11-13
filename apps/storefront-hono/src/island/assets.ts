import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { honoIslandFile, islandFileType } from '@/lib/hono-island/route'

/**
 * The built island (`scripts/build-island.ts` → `dist/island/`): its entry script's and global
 * stylesheet's names for the page, and the files themselves for `/hono-island/<file>` (which the
 * Next storefront's `/api/hono-island/<file>` passes on). Without a build, product pages are
 * skipped, so Next draws them.
 */

const DIR = join(import.meta.dir, '..', '..', 'dist', 'island')

export type IslandBuild = { entry: string; css: string }

let build: IslandBuild | null | undefined

/** The entry script's and stylesheet's names, or null when the island was not built. */
export function islandBuild(): IslandBuild | null {
  if (build !== undefined) return build
  const manifest = join(DIR, 'manifest.json')
  const read = existsSync(manifest)
    ? (JSON.parse(readFileSync(manifest, 'utf8')) as Partial<IslandBuild>)
    : {}
  build = read.entry && read.css ? { entry: read.entry, css: read.css } : null
  return build
}

/** One built file and its content type, or null. */
export function islandFile(name: string): { file: Blob; type: string } | null {
  const file = honoIslandFile(name)
  if (!file) return null
  const path = join(DIR, file)
  return existsSync(path) ? { file: Bun.file(path), type: islandFileType(file) } : null
}
