/**
 * Sweep: duplicate helpers. Each helper in `HELPER_OWNERS` (`consistency.ts`) has one home —
 * `settingsSecret` in @commerce/config, `safeEqual` in @commerce/payments, `isUniqueViolation`
 * in @commerce/db, `parseRupees`/`formatSignedMoney`/`formatPercent` in @commerce/money,
 * `IST_OFFSET_MS`/`msUntil`/`formatCountdown` in @commerce/dates, `slugify` and
 * `msUntilLaunch` in core, `initials` in the admin lib, ... A function or const with one of
 * those names declared anywhere else is a copy: import the owner instead. Names whose owner
 * list is empty (`toPaise`, `inr`, `todayIst`, `formatSigned`, `IST_MS`) were folded into
 * another owner and must not come back.
 * Also: no inline `loadEnv(process.env).SETTINGS_SECRET` outside @commerce/config, and no IST
 * offset spelled out (`330 * 60 * 1000`, `5.5 * 3_600_000`) outside @commerce/dates.
 *
 * Ratchet: a NEW copy fails; deleting a copy means deleting its entry (stale entries fail).
 */
import { describe, expect, it } from 'vitest'
import {
  duplicateHelperDeclarations,
  inlineIstOffsets,
  inlineSettingsSecretReads,
} from './consistency'

type AllowEntry = { site: string; reason: string }

const ALLOWLIST: AllowEntry[] = [
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

  it('the IST offset is only spelled out in @commerce/dates', async () => {
    expect(await inlineIstOffsets(), 'import IST_OFFSET_MS / wallClock / dayKey').toEqual([])
  })
})
