import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SECTION_CATEGORIES } from '@commerce/blocks/puck'
import { GROUP_SECTIONS } from '@commerce/core/theme'
import { describe, expect, it } from 'vitest'
import { SECTION_PREVIEWS } from './section-previews'

const DIR = fileURLToPath(new URL('../../public/section-previews/', import.meta.url))
const ADDABLE = new Set<string>([
  ...Object.values(SECTION_CATEGORIES).flatMap((c) => [...c.components] as string[]),
  ...Object.values(GROUP_SECTIONS).flat(),
])

describe('section pictures (bun run section-previews)', () => {
  it('has a light and a dark file of at most 40 KB for every listed type', () => {
    for (const type of Object.keys(SECTION_PREVIEWS)) {
      for (const name of [`${type}.webp`, `${type}-dark.webp`]) {
        expect(existsSync(DIR + name), name).toBe(true)
        expect(statSync(DIR + name).size, name).toBeLessThanOrEqual(40 * 1024)
      }
    }
  })

  it('lists only sections the Add panel offers, each with a sane shape', () => {
    for (const [type, ratio] of Object.entries(SECTION_PREVIEWS)) {
      expect(ADDABLE.has(type), type).toBe(true)
      expect(ratio).toBeGreaterThan(0)
      expect(ratio).toBeLessThanOrEqual(0.75)
    }
  })
})
