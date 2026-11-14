/**
 * Sweep: one popup shell in the admin (audit 9d, 14 Nov 2026). Every admin dialog draws with
 * `components/layout/dialog-content` (+ `dialog-header`, `dialog-footer`), or through FormDialog
 * and ConfirmDialog which sit on it: one set of widths (`standard`, `wide`, `full`), the title
 * clear of the X, a sticky footer that stacks on phones, and `busy` / `dirty` close guards.
 * Importing `DialogContent`, `DialogHeader` or `DialogFooter` from `@commerce/ui/shadcn/dialog`
 * (the raw shadcn parts) bypasses all of that, and so does a direct `AlertDialog`.
 *
 * Allowed: the shell itself, and the command palette (a search box at the top of the screen, not
 * a dialog; audit 3.2 G14). The list may only shrink.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listFiles, toRel } from './walk'

const ALLOWLIST: Record<string, string> = {
  'apps/admin/src/components/layout/dialog-content.tsx': 'the shell: it wraps the raw part',
  'apps/admin/src/components/layout/dialog-header.tsx': 'the shell header',
  'apps/admin/src/components/layout/dialog-footer.tsx': 'the shell footer',
  'apps/admin/src/components/layout/command-palette.tsx':
    'the command palette: a search box pinned near the top, no title bar or footer',
}

const RAW_PARTS = /import\s*\{([^}]*)\}\s*from\s*'@commerce\/ui\/shadcn\/(dialog|alert-dialog)'/g

function rawParts(source: string): string[] {
  const found: string[] = []
  for (const m of source.matchAll(RAW_PARTS)) {
    const names = (m[1] ?? '').split(',').map(
      (n) =>
        n
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0] ?? '',
    )
    if (m[2] === 'alert-dialog') found.push(...names.filter((n) => n.startsWith('AlertDialog')))
    else
      found.push(
        ...names.filter((n) => ['DialogContent', 'DialogHeader', 'DialogFooter'].includes(n)),
      )
  }
  return found
}

describe('sweep: popup-shell', () => {
  it('admin dialogs use the layout shell, not raw shadcn DialogContent / AlertDialog', async () => {
    const files = await listFiles(['apps/admin/src'])
    const offenders: string[] = []
    const used = new Set<string>()
    for (const file of files) {
      if (!file.endsWith('.tsx')) continue
      const rel = toRel(file)
      const parts = rawParts(readFileSync(file, 'utf8'))
      if (parts.length === 0) continue
      if (ALLOWLIST[rel]) used.add(rel)
      else offenders.push(`${rel}: ${parts.join(', ')}`)
    }
    expect(
      offenders,
      `use components/layout/dialog-content (+ dialog-header, dialog-footer), FormDialog or ConfirmDialog:\n${offenders.join('\n')}`,
    ).toEqual([])
    const stale = Object.keys(ALLOWLIST).filter((f) => !used.has(f))
    expect(stale, 'allow-listed file no longer imports a raw part: remove it').toEqual([])
  })
})
