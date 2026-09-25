/**
 * Sweep: `Intl.NumberFormat(...)` call sites outside the canonical money module
 * (`packages/money`, `@commerce/money`). `formatMoney`/`formatNumber` there are the
 * one place this repo should call `Intl.NumberFormat` for money or locale-grouped
 * numbers — everything else on this list is either a percentage formatter (a
 * different unit, not money) or the animated counter's internal digit regrouping.
 * Naming it "money-format" (not "intl-number-format") is deliberate, so it's easy to
 * re-point future formatters at that module.
 *
 * Ratchet: a NEW `Intl.NumberFormat` call outside the allow-list fails the sweep.
 */
import { describe, expect, it } from 'vitest'
import { findIntlNumberFormat, listFiles, loadSourceFile, toRel } from './walk'

type AllowEntry = { file: string; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    file: 'apps/admin/src/components/abandoned/abandoned-tiles.tsx',
    reason: 'percentage formatter (style: "percent") — not money, no shared module for it',
  },
  {
    file: 'apps/admin/src/components/home/insights-list.tsx',
    reason: 'percentage formatter (style: "percent") — not money, no shared module for it',
  },
  {
    file: 'apps/admin/src/components/layout/count-up.tsx',
    reason:
      'regroups digits per animation frame for whatever string it was given (money, percent, plain) — a generic animation helper, not a money formatter itself',
  },
  {
    file: 'apps/admin/src/lib/analytics-range.ts',
    reason: 'percentage formatter (style: "percent") for analytics deltas — not money',
  },
]

function isAllowlisted(file: string): boolean {
  return ALLOWLIST.some((e) => e.file === file)
}

async function findViolations(): Promise<string[]> {
  const files = await listFiles(['apps', 'packages'], { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    if (rel.startsWith('packages/money/src/')) continue
    const sf = loadSourceFile(f)
    if (findIntlNumberFormat(sf).length > 0) out.push(rel)
  }
  return out
}

describe('sweep: money-format', () => {
  it('every Intl.NumberFormat call site is allow-listed with a reason', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !isAllowlisted(v))
    expect(unlisted, `new Intl.NumberFormat call site:\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const violations = await findViolations()
    const stale = ALLOWLIST.filter((e) => !violations.includes(e.file))
    expect(stale).toEqual([])
  })
})
