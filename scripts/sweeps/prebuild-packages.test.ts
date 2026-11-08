/**
 * Sweep: the image build's package prebuild (`scripts/prebuild-packages.ts`). Not a ratchet.
 * Checks the export and import rewriting, that client React code stays as source (so it keeps
 * the React Compiler), and that both app Dockerfiles run the step before `next build`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  KEEP_SOURCE,
  pointsAtDist,
  prebuildTargets,
  prebuiltExports,
  rewriteSpecifiers,
} from '../prebuild-packages'
import { ROOT } from './walk'

const CLIENT_DIRECTIVE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use client\1/

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) tsFiles(full, out)
    else if (/\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$|\.d\.ts$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('prebuild-packages', () => {
  it('points src exports at dist, keeping .tsx, non-src files and types', () => {
    expect(
      prebuiltExports({
        '.': './src/index.ts',
        './blocks': './src/blocks.tsx',
        './data': './src/catalog/taxonomy.json',
        './test': './test/reset.ts',
        './hooks/*': './src/hooks/*.ts',
        './typed': { types: './src/typed.ts', default: './src/typed.ts' },
      }),
    ).toEqual({
      '.': './dist/index.js',
      './blocks': './dist/blocks.tsx',
      './data': './dist/catalog/taxonomy.json',
      './test': './test/reset.ts',
      './hooks/*': './dist/hooks/*.js',
      './typed': { types: './src/typed.ts', default: './dist/typed.js' },
    })
    expect(pointsAtDist({ '.': './dist/index.js' })).toBe(true)
    expect(pointsAtDist({ '.': './src/index.ts' })).toBe(false)
  })

  it('gives relative imports their output file name and reports the ones it cannot find', () => {
    const map: Record<string, string> = { './a': './a.js', '../b': '../b/index.js' }
    const { code, unresolved } = rewriteSpecifiers(
      [
        "import { a } from './a';",
        "export * from '../b';",
        "import './a';",
        "const m = await import(/* webpackIgnore: true */ './a');",
        "import x from 'zod';",
        "import y from './missing';",
      ].join('\n'),
      (spec) => map[spec] ?? null,
    )
    expect(code).toContain("from './a.js'")
    expect(code).toContain("from '../b/index.js'")
    expect(code).toContain("import './a.js'")
    expect(code).toContain("import(/* webpackIgnore: true */ './a.js')")
    expect(code).toContain("from 'zod'")
    expect(unresolved).toEqual(['./missing'])
  })

  it('keeps every KEEP_SOURCE package real and out of the prebuild', () => {
    const targets = prebuildTargets(ROOT).map(
      (dir) => JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).name as string,
    )
    for (const name of Object.keys(KEEP_SOURCE)) {
      expect(existsSync(path.join(ROOT, 'packages', name.replace('@commerce/', '')))).toBe(true)
      expect(targets).not.toContain(name)
    }
  })

  it("has no 'use client' .ts file in a prebuilt package (it would skip the React Compiler)", () => {
    const offenders = prebuildTargets(ROOT).flatMap((dir) =>
      tsFiles(path.join(dir, 'src'))
        .filter((file) => CLIENT_DIRECTIVE.test(readFileSync(file, 'utf8')))
        .map((file) => path.relative(ROOT, file).replaceAll('\\', '/')),
    )
    expect(offenders, 'move it to a .tsx, or add its package to KEEP_SOURCE').toEqual([])
  })

  it.each(['apps/admin/Dockerfile', 'apps/storefront/Dockerfile'])(
    '%s prebuilds before next build',
    (file) => {
      const text = readFileSync(path.join(ROOT, file), 'utf8')
      const prebuild = text.indexOf('RUN bun scripts/prebuild-packages.ts')
      expect(prebuild).toBeGreaterThan(text.indexOf('COPY --from=pruner /repo/out/full/'))
      expect(prebuild).toBeGreaterThan(
        text.indexOf('COPY --from=pruner /repo/scripts/prebuild-packages.ts'),
      )
      expect(prebuild).toBeLessThan(text.indexOf('bun run build --filter='))
      expect(text).toContain('ARG BUILD_PREBUILT=1')
    },
  )
})
