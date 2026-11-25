/** SOURCE OF TRUTH: the "Add a way to earn" catalog — WHAT: every earning rule a store can add, grouped (store activity, reviews, social), which are already taken, a new rule's starting values, and the input `loyalty.rules.save` takes from the rule editor / WHY: a store has one rule per type (one per platform for social), so the dialog and the editor must agree on what is free to add and what each rule needs */
import type { EarnRuleRow } from '@commerce/core'
import {
  type EarnRuleInput,
  LOYALTY_SOCIAL_KINDS,
  type LoyaltyRuleType,
} from '@commerce/core/loyalty'

export type RuleGroup = 'store' | 'reviews' | 'social'

/** One entry of the catalog: a rule type, and for social the platform. */
export type RuleChoice = { type: LoyaltyRuleType; key: string; group: RuleGroup }

/** `order_spend` is the program's base rate (its own card), so it is not in the catalog. */
const STORE: LoyaltyRuleType[] = [
  'signup',
  'first_order',
  'newsletter',
  'birthday',
  'anniversary',
  'daily_visit',
  'visit_streak',
]

export const RULE_CATALOG: RuleChoice[] = [
  ...STORE.map((type) => ({ type, key: '', group: 'store' as const })),
  { type: 'product_review', key: '', group: 'reviews' },
  { type: 'google_review', key: '', group: 'reviews' },
  ...LOYALTY_SOCIAL_KINDS.map((key) => ({
    type: 'social' as const,
    key,
    group: 'social' as const,
  })),
]

export const ruleKey = (r: { type: string; key: string }) => `${r.type}:${r.key}`

/** Rules with a link to open: social platforms and the Google review. */
export const ruleNeedsUrl = (type: LoyaltyRuleType) => type === 'social' || type === 'google_review'

/** Points a new rule starts with. */
const START_POINTS: Partial<Record<LoyaltyRuleType, number>> = {
  signup: 50,
  first_order: 100,
  newsletter: 25,
  birthday: 100,
  anniversary: 100,
  daily_visit: 1,
  visit_streak: 20,
  product_review: 25,
  google_review: 50,
  social: 25,
}

/** The rule editor's fields. */
export type RuleForm = {
  id: string | null
  type: LoyaltyRuleType
  key: string
  title: string
  points: number
  url: string
  action: 'follow' | 'join' | 'subscribe' | 'visit'
  days: number
  enabled: boolean
  position: number
}

export function newRuleForm(choice: RuleChoice, position: number): RuleForm {
  return {
    id: null,
    type: choice.type,
    key: choice.key,
    title: '',
    points: START_POINTS[choice.type] ?? 10,
    url: '',
    action: choice.key === 'link' ? 'visit' : 'follow',
    days: 7,
    enabled: true,
    position,
  }
}

export function ruleFormOf(r: EarnRuleRow): RuleForm {
  const s = r.settings as { url?: unknown; action?: unknown; days?: unknown }
  const action = ['follow', 'join', 'subscribe', 'visit'].includes(String(s.action))
    ? (s.action as RuleForm['action'])
    : 'follow'
  return {
    id: r.id,
    type: r.type,
    key: r.key,
    title: r.title ?? '',
    points: r.points,
    url: typeof s.url === 'string' ? s.url : '',
    action,
    days: typeof s.days === 'number' ? s.days : 7,
    enabled: r.enabled,
    position: r.position,
  }
}

/** What `loyalty.rules.save` takes; settings only carry what the type uses. */
export function ruleInputOf(f: RuleForm): EarnRuleInput {
  const settings: Record<string, unknown> =
    f.type === 'social'
      ? { url: f.url.trim(), action: f.action }
      : f.type === 'google_review'
        ? { url: f.url.trim() }
        : f.type === 'visit_streak'
          ? { days: f.days }
          : {}
  const title = f.title.trim()
  return {
    type: f.type,
    key: f.type === 'social' ? f.key : '',
    title: title === '' ? null : title,
    points: f.points,
    settings,
    enabled: f.enabled,
    position: f.position,
  }
}

/** A link the server will take: http(s) only. */
export function validUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
