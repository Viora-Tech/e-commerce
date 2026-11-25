/** SOURCE OF TRUTH: the Loyalty program page's form — WHAT: the draft the page edits (settings, the order spend rule and every VIP tier), how it is made from the API rows, what changed since the last save, and the small number conversions (multiplier, tier threshold) / WHY: one Save bar saves settings, the spend rule and tiers together, so the page must know exactly which pieces changed */
import type { EarnRuleRow, TierRow } from '@commerce/core'
import type { LoyaltySettings, TierInput } from '@commerce/core/loyalty'

/** Colours a new tier's member card starts with (the card's own preview, not admin chrome). */
export const TIER_COLOR_PRESETS = [
  { background: '#4b5563', text: '#ffffff' },
  { background: '#b45309', text: '#ffffff' },
  { background: '#6b7280', text: '#ffffff' },
  { background: '#a16207', text: '#ffffff' },
  { background: '#1f2937', text: '#f9fafb' },
] as const

export type TierColors = { background: string; text: string }

/** The preset for the n-th tier, going round the list. */
const presetAt = (n: number): TierColors => {
  const p = TIER_COLOR_PRESETS[n % TIER_COLOR_PRESETS.length] ?? TIER_COLOR_PRESETS[0]
  return { background: p.background, text: p.text }
}

/** One tier as the form holds it; `key` is stable for a tier not saved yet. */
export type TierDraft = {
  key: string
  id: string | null
  name: string
  threshold: number
  multiplierBp: number
  perks: string[]
  rewardId: string | null
  customerTag: string
  colors: TierColors
  position: number
}

export type SpendDraft = {
  id: string | null
  points: number
  excludeProductTags: string[]
  enabled: boolean
}

export type ProgramDraft = {
  settings: LoyaltySettings
  spend: SpendDraft
  tiers: TierDraft[]
}

/** The order spend rule, or the v1 rate when the store has none yet. */
export function spendDraftOf(rules: readonly EarnRuleRow[], settings: LoyaltySettings): SpendDraft {
  const rule = rules.find((r) => r.type === 'order_spend')
  if (!rule) {
    return { id: null, points: settings.pointsPer100, excludeProductTags: [], enabled: true }
  }
  const raw = (rule.settings as { excludeProductTags?: unknown }).excludeProductTags
  return {
    id: rule.id,
    points: rule.points,
    excludeProductTags: Array.isArray(raw) ? raw.filter((t) => typeof t === 'string') : [],
    enabled: rule.enabled,
  }
}

export function tierDraftOf(t: TierRow, index: number): TierDraft {
  return {
    key: t.id,
    id: t.id,
    name: t.name,
    threshold: t.threshold,
    multiplierBp: t.multiplierBp,
    perks: [...t.perks],
    rewardId: t.rewardId,
    customerTag: t.customerTag ?? '',
    colors: t.colors ?? presetAt(index),
    position: t.position,
  }
}

export function programDraftOf(
  settings: LoyaltySettings,
  rules: readonly EarnRuleRow[],
  tiers: readonly TierRow[],
): ProgramDraft {
  return {
    settings,
    spend: spendDraftOf(rules, settings),
    tiers: tiers.map(tierDraftOf),
  }
}

/**
 * A new tier after the ones there: twice the highest threshold (or 500 points / ₹5,000 for the
 * first), the multiplier a step up, the next colour.
 */
export function newTierDraft(
  tiers: readonly TierDraft[],
  basis: LoyaltySettings['tierBasis'],
  name: string,
  key: string,
): TierDraft {
  const top = tiers.reduce<TierDraft | null>(
    (best, t) => (!best || t.threshold > best.threshold ? t : best),
    null,
  )
  const first = basis === 'spend' ? 500_000 : 500
  return {
    key,
    id: null,
    name,
    threshold: top ? Math.max(first, top.threshold * 2) : 0,
    multiplierBp: top ? top.multiplierBp + 2_500 : 10_000,
    perks: [],
    rewardId: null,
    customerTag: '',
    colors: presetAt(tiers.length),
    position: tiers.length,
  }
}

/** What `loyalty.tiers.save` takes for a drafted tier. */
export function tierInputOf(t: TierDraft): TierInput {
  const tag = t.customerTag.trim()
  return {
    name: t.name.trim(),
    threshold: t.threshold,
    multiplierBp: t.multiplierBp,
    perks: t.perks.map((p) => p.trim()).filter(Boolean),
    rewardId: t.rewardId,
    customerTag: tag === '' ? null : tag,
    colors: t.colors,
    position: t.position,
  }
}

/** Tiers that are new or differ from the saved ones. */
export function changedTiers(
  draft: readonly TierDraft[],
  saved: readonly TierDraft[],
): TierDraft[] {
  const before = new Map(saved.map((t) => [t.key, JSON.stringify(t)]))
  return draft.filter((t) => t.id === null || before.get(t.key) !== JSON.stringify(t))
}

export const settingsChanged = (a: LoyaltySettings, b: LoyaltySettings) =>
  JSON.stringify(a) !== JSON.stringify(b)

export const spendChanged = (a: SpendDraft, b: SpendDraft) =>
  JSON.stringify(a) !== JSON.stringify(b)

/** "1.25" for 12500 basis points (the field shows the "x" beside it). */
export function multiplierText(bp: number): string {
  return String(Math.round(bp / 100) / 100)
}

/** Basis points for a typed multiplier ("1.5" → 15000); null when it is not a number 0 to 10. */
export function parseMultiplier(raw: string): number | null {
  const n = Number(raw.trim())
  if (raw.trim() === '' || !Number.isFinite(n) || n < 0 || n > 10) return null
  return Math.round(n * 10_000)
}

/** The threshold field's number: points as they are, spend in whole rupees. */
export function thresholdFieldValue(threshold: number, basis: LoyaltySettings['tierBasis']) {
  return basis === 'spend' ? Math.round(threshold / 100) : threshold
}

export function thresholdFromField(n: number, basis: LoyaltySettings['tierBasis']) {
  const whole = Math.max(0, Math.round(n))
  return basis === 'spend' ? whole * 100 : whole
}

/** Lower-cased, trimmed, unique, emails only (test accounts). */
export function cleanEmails(list: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of list) {
    const e = raw.trim().toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !out.includes(e)) out.push(e)
  }
  return out
}
