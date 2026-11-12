/**
 * Sweep: every write of `store.apps` goes through the row lock. Services read the whole apps
 * record, change their own part and save it all; without the lock two writers at once lose one
 * change (installed apps vanished on Waimers, #1523). So a file that writes `apps` on the
 * `store` table must take the row lock with `lockStoreApps` (packages/core/src/apps/locked.ts)
 * before it reads what it writes back.
 *
 * Ratchet: a new unlocked writer fails; an allow-listed file that is fixed must leave the list.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listFiles, toRel } from './walk'

type AllowEntry = { file: string; reason: string }

const ALLOWLIST: AllowEntry[] = []

/** `update(store)` with `apps` in the values: `.set({ apps })`, `set.apps = …`. */
function writesStoreApps(text: string): boolean {
  if (!/\.update\(store\)/.test(text)) return false
  return /\.set\(\{[^)]*\bapps\b/.test(text) || /\b\w+\.apps\s*=[^=]/.test(text)
}

const locks = (text: string) => /\blockStoreApps\(/.test(text)

async function findViolations(): Promise<string[]> {
  const files = await listFiles(['apps', 'packages', 'scripts'], { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    if (writesStoreApps(text) && !locks(text)) out.push(toRel(f))
  }
  return out
}

describe('sweep: store-apps-writes', () => {
  it('spots a write of store.apps', () => {
    expect(writesStoreApps('tx.update(store).set({ apps: next })')).toBe(true)
    expect(
      writesStoreApps(
        'tx\n  .update(store)\n  .set({\n    gstin,\n    apps: withStoreTax(a, t),\n  })',
      ),
    ).toBe(true)
    expect(writesStoreApps('const set = {}\nset.apps = x\nawait tx.update(store).set(set)')).toBe(
      true,
    )
    expect(writesStoreApps('tx.update(store).set({ notifications })')).toBe(false)
    expect(writesStoreApps('if (s.apps === null) tx.update(store).set({ name })')).toBe(false)
  })

  it('every writer of store.apps takes the row lock', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !ALLOWLIST.some((e) => e.file === v))
    expect(unlisted, `store.apps written without lockStoreApps:\n${unlisted.join('\n')}`).toEqual(
      [],
    )
  })

  it('the allow-list has no stale entries', async () => {
    const violations = await findViolations()
    expect(ALLOWLIST.filter((e) => !violations.includes(e.file))).toEqual([])
  })
})
