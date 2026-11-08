import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { dropPrebuilt } from './lean-build'

const root = mkdtempSync(join(tmpdir(), 'lean-build-'))
function pkg(dir: string, exports: unknown) {
  mkdirSync(join(root, 'packages', dir), { recursive: true })
  writeFileSync(join(root, 'packages', dir, 'package.json'), JSON.stringify({ exports }))
}
pkg('core', { '.': './dist/index.js', './gst': './dist/tax/gst.js' })
pkg('ui', { '.': './src/index.ts' })
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('dropPrebuilt', () => {
  const config = { transpilePackages: ['@commerce/core', '@commerce/ui', '@commerce/missing', 'x'] }

  it('drops only packages whose exports point at dist/', () => {
    expect(dropPrebuilt(config, root, {}).transpilePackages).toEqual([
      '@commerce/ui',
      '@commerce/missing',
      'x',
    ])
  })

  it('keeps the list as written with BUILD_PREBUILT=0', () => {
    expect(dropPrebuilt(config, root, { BUILD_PREBUILT: '0' })).toBe(config)
  })
})
