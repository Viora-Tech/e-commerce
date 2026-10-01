/**
 * Sweep: duplicate helpers. Each helper in `HELPER_OWNERS` (`consistency.ts`) has one home —
 * `settingsSecret` in @commerce/config, `safeEqual` in @commerce/payments, `isUniqueViolation`
 * in @commerce/db, `parseRupees`/`formatSignedMoney`/`formatPercent` in @commerce/money,
 * `IST_OFFSET_MS` in @commerce/dates, `slugify` and `msUntilLaunch` in core, `initials` in the
 * admin lib, ... A function or const with one of those names declared anywhere else is a copy:
 * import the owner instead. Names whose owner list is empty (`toPaise`, `inr`, `todayIst`,
 * `formatSigned`, `readTestedFlag`) were folded into another owner and must not come back.
 * Also: no inline `loadEnv(process.env).SETTINGS_SECRET` outside @commerce/config.
 *
 * Ratchet: a NEW copy fails; deleting a copy means deleting its entry (stale entries fail).
 */
import { describe, expect, it } from 'vitest'
import { duplicateHelperDeclarations, inlineSettingsSecretReads } from './consistency'

type AllowEntry = { site: string; reason: string }

const PARALLEL_GST =
  'IST offset copy in the GST/invoices packages, which the GST registrations build is changing in parallel — move to @commerce/dates after it merges'
const BLOCKS =
  'packages/blocks is being rebuilt in parallel (Glide theme sections) — use msUntilLaunch from @commerce/core/preorder after it merges'

const ALLOWLIST: AllowEntry[] = [
  {
    site: 'packages/blocks/src/app-blocks/preorder-countdown-block.tsx: msUntilLaunch',
    reason: BLOCKS,
  },
  { site: 'packages/blocks/src/components/product-view.tsx: msUntilLaunch', reason: BLOCKS },
  { site: 'packages/invoices/src/numbering.ts: IST_OFFSET_MS', reason: PARALLEL_GST },
  { site: 'packages/plugin-gst-invoices/src/periods.ts: IST_OFFSET_MS', reason: PARALLEL_GST },
  { site: 'packages/plugin-gst-invoices/src/queue.ts: IST_OFFSET_MS', reason: PARALLEL_GST },
  {
    site: 'packages/payments-decentro/src/client.ts: toPaise',
    reason:
      "adapter-private: converts Decentro's rupee amounts (numbers or strings in API answers) to paise; not typed merchant input, so parseRupees' null-for-junk rule does not fit",
  },
]

describe('sweep: duplicate-helpers', () => {
  it('every copy of a single-home helper is allow-listed with a reason', async () => {
    const sites = await duplicateHelperDeclarations()
    const unlisted = sites.filter((s) => !ALLOWLIST.some((e) => e.site === s))
    expect(unlisted, `helper copies (import the owner):\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const sites = await duplicateHelperDeclarations()
    expect(ALLOWLIST.filter((e) => !sites.includes(e.site))).toEqual([])
  })

  it('SETTINGS_SECRET is only read through settingsSecret()', async () => {
    expect(await inlineSettingsSecretReads()).toEqual([])
  })
})
