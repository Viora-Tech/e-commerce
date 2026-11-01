import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SETTINGS_REDIRECTS } from './settings-redirects'

const ADMIN = join(__dirname, '..', '..')
const REPO = join(ADMIN, '..', '..')
const ROUTES = join(ADMIN, 'src', 'app', '(admin)')

/** The route folder an address is served from (`/settings/privacy/:path*` → its base folder). */
const folderOf = (path: string) => join(ROUTES, ...path.replace('/:path*', '').split('/'))

/** Every .ts/.tsx/.mdx file under `dir`, skipping build output and dependencies. */
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) return []
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(tsx?|mdx?)$/.test(name) ? [full] : []
  })
}

const OLD = SETTINGS_REDIRECTS.filter((r) => !r.source.includes(':')).map((r) => r.source)
/** A link to an old address in code: quoted, then a path end, `/`, `?` or `#`. */
const OLD_LINK = new RegExp(
  `['"\`(](${OLD.map((p) => p.replaceAll('/', '\\/')).join('|')})(?=['"\`)/?#])`,
)

describe('settings redirects', () => {
  it('lead from addresses no page serves any more', () => {
    const stillServed = SETTINGS_REDIRECTS.filter((r) => existsSync(folderOf(r.source)))
    expect(stillServed).toEqual([])
  })

  it('lead to real pages', () => {
    const missing = SETTINGS_REDIRECTS.filter((r) => {
      const folder = folderOf(r.destination)
      return r.destination.includes(':')
        ? !existsSync(folder)
        : !existsSync(join(folder, 'page.tsx'))
    })
    expect(missing).toEqual([])
  })

  it('never chain (a destination is never itself redirected)', () => {
    const sources = new Set(SETTINGS_REDIRECTS.map((r) => r.source))
    expect(SETTINGS_REDIRECTS.filter((r) => sources.has(r.destination))).toEqual([])
  })

  it('cover every page that moved', () => {
    expect(Object.fromEntries(SETTINGS_REDIRECTS.map((r) => [r.source, r.destination]))).toEqual({
      '/settings/general': '/settings/store',
      '/settings/business': '/settings/taxes',
      '/settings/customer-privacy': '/settings/privacy',
      '/settings/customer-privacy/:path*': '/settings/privacy/:path*',
      '/settings/account': '/account',
      '/settings/files': '/content/files/storage',
      '/settings/markets': '/markets',
      '/settings/markets/rollouts': '/markets/rollouts',
      '/settings/markets/rollouts/:path*': '/markets/rollouts/:path*',
      '/rollouts': '/markets/rollouts',
      '/rollouts/:path*': '/markets/rollouts/:path*',
    })
  })

  it('are served by next.config', () => {
    const config = readFileSync(join(ADMIN, 'next.config.ts'), 'utf8')
    expect(config).toMatch(/\.\.\.SETTINGS_REDIRECTS\.map/)
  })

  it('are not needed by our own links (admin, packages, docs)', () => {
    const roots = [
      join(ADMIN, 'src'),
      join(REPO, 'apps', 'storefront', 'src'),
      join(REPO, 'apps', 'worker', 'src'),
      join(REPO, 'apps', 'docs', 'content'),
      ...readdirSync(join(REPO, 'packages')).map((p) => join(REPO, 'packages', p, 'src')),
    ]
    const self = new Set([join(__dirname, 'settings-redirects.ts'), __filename])
    const offenders = roots
      .flatMap(sourceFiles)
      .filter((f) => !self.has(f) && OLD_LINK.test(readFileSync(f, 'utf8')))
      .map((f) => relative(REPO, f).replaceAll('\\', '/'))
    expect(offenders).toEqual([])
  }, 60_000) // Reads a few thousand files; a cold disk on Windows takes a while.
})
