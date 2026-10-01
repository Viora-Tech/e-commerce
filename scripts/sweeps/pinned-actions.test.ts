/**
 * Sweep: every action a GitHub workflow uses is pinned to a full commit SHA with the release
 * as a comment (`uses: owner/repo@<40 hex> # v1.2.3`). A tag like `@v3` can be moved by
 * whoever controls the action's repository, and the release job holds a GHCR write token.
 * Not a ratchet: there are no exceptions (security audit D-02). Local actions (`./…`) and
 * `docker://` images with a digest are fine.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './walk'

const WORKFLOWS = path.join(ROOT, '.github', 'workflows')
const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+(\.\d+)*\s*$/

function unpinnedUses(text: string): string[] {
  const bad: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-?\s*uses:\s*(.+)$/)
    if (!m?.[1]) continue
    const ref = m[1].trim().replace(/^['"]|['"]$/g, '')
    if (ref.startsWith('./')) continue
    if (ref.startsWith('docker://') && /@sha256:[0-9a-f]{64}/.test(ref)) continue
    if (!PINNED.test(ref)) bad.push(ref)
  }
  return bad
}

describe('sweep: pinned-actions', () => {
  it('recognises pinned and unpinned references', () => {
    expect(
      unpinnedUses(
        [
          '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
          '      - uses: docker/login-action@v3',
          '      - uses: ./local-action',
          '      - uses: some/action@11d5960a326750d5838078e36cf38b85af677262',
        ].join('\n'),
      ),
    ).toEqual(['docker/login-action@v3', 'some/action@11d5960a326750d5838078e36cf38b85af677262'])
  })

  it('every workflow pins its actions to a commit SHA with a version comment', () => {
    const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))
    expect(files.length).toBeGreaterThan(0)
    const hits = files.flatMap((f) =>
      unpinnedUses(readFileSync(path.join(WORKFLOWS, f), 'utf8')).map((ref) => `${f}: ${ref}`),
    )
    expect(hits, `unpinned actions: ${hits.join(', ')}`).toEqual([])
  })
})
