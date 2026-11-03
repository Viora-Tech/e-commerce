import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FONT_FILES } from '@commerce/invoices/pdf'
import { describe, expect, it } from 'vitest'
import { TRACED_RUNTIME_FILES } from './traced-files'

const adminDir = fileURLToPath(new URL('../..', import.meta.url))

/** The Next tracing globs we use: `**` crosses folders, `*` stays within one. */
function globMatches(glob: string, path: string): boolean {
  const pattern = glob
    .split(/(\*\*\/|\*)/)
    .map((part) =>
      part === '**/'
        ? '(?:.*/)?'
        : part === '*'
          ? '[^/]*'
          : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('')
  return new RegExp(`^${pattern}$`).test(path)
}

const traced = (rel: string) => TRACED_RUNTIME_FILES.some((glob) => globMatches(glob, rel))

describe('files the standalone image must carry', () => {
  it('every listed path exists from apps/admin', () => {
    for (const glob of TRACED_RUNTIME_FILES) {
      const fixed = glob.split('*')[0] ?? glob
      expect(existsSync(join(adminDir, fixed)), glob).toBe(true)
    }
  })

  // The GST settings preview drew nothing on the live admin: the font route read
  // packages/invoices/fonts by path, tracing never copied it, and react-pdf rejects the whole
  // render when a registered font fails to load.
  it('includes every invoice font the preview loads', () => {
    const files = Object.values(FONT_FILES).flatMap((weights) => Object.values(weights))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const rel = `../../packages/invoices/fonts/${file}`
      expect(existsSync(join(adminDir, rel)), rel).toBe(true)
      expect(traced(rel), rel).toBe(true)
    }
  })

  it('includes the PIN code directory', () => {
    expect(traced('../../packages/shipping/data/pincode-directory.json.gz')).toBe(true)
  })
})
