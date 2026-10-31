import type { RolloutChangeInput, RolloutConflict, RolloutView } from '@commerce/core'
import type { CheckoutBranding } from '@commerce/core/checkout-settings'
import { fromLocalInput, toLocalInput } from '@/components/discounts/form-state'
import type { rolloutsContent } from '@/data/rollouts'

/** One discount the rollout switches, with what the picker or the server said about it. */
export type DiscountPick = {
  id: string
  title: string | null
  status: 'active' | 'disabled'
}

/** An A/B test's audience as the form edits it; the target is the field's text. */
export type AudienceForm = {
  split: number
  traffic: number
  marketIds: string[]
  target: string
}

export const DEFAULT_AUDIENCE: AudienceForm = { split: 50, traffic: 100, marketIds: [], target: '' }

/** The rollout page's form: `null` means that kind of change is not in the rollout. */
export type RolloutFormState = {
  name: string
  kind: 'launch' | 'event'
  /** `datetime-local` values in the store's zone. */
  startsAt: string
  endsAt: string
  endAction: 'rollback' | 'apply'
  themeId: string | null
  branding: CheckoutBranding | null
  discounts: DiscountPick[]
  notes: string
  /** Null: the changes go live for everyone; set: an A/B test, Control vs Treatment. */
  audience: AudienceForm | null
}

/** Server-checked clashes, as the conflict banner shows them. */
export type Conflicts = RolloutConflict[]

export const MAX_DISCOUNTS = 250

export function emptyRollout(): RolloutFormState {
  return {
    name: '',
    kind: 'event',
    startsAt: '',
    endsAt: '',
    endAction: 'rollback',
    themeId: null,
    branding: null,
    discounts: [],
    notes: '',
    audience: null,
  }
}

export function fromRollout(r: RolloutView): RolloutFormState {
  const theme = r.changes.find((c) => c.kind === 'theme')
  const branding = r.changes.find((c) => c.kind === 'checkout_branding')
  return {
    name: r.name,
    kind: r.kind,
    startsAt: toLocalInput(r.startsAt),
    endsAt: toLocalInput(r.endsAt),
    endAction: r.endAction,
    themeId: theme?.kind === 'theme' ? theme.themeId : null,
    branding:
      branding?.kind === 'checkout_branding' ? (branding.branding as CheckoutBranding) : null,
    discounts: r.changes.flatMap((c) =>
      c.kind === 'discount' ? [{ id: c.discountId, title: c.label, status: c.status }] : [],
    ),
    notes: r.notes,
    audience: r.audience
      ? {
          split: r.audience.split,
          traffic: r.audience.traffic,
          marketIds: r.audience.marketIds,
          target: r.audience.target ? String(r.audience.target) : '',
        }
      : null,
  }
}

/** The target field as a whole number of visitors; null when empty or not a number. */
function targetOf(text: string): number | null {
  const n = Number.parseInt(text.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** What `rollouts.create` / `update` / `checkConflicts` take. */
export function toRolloutInput(f: RolloutFormState) {
  const changes: RolloutChangeInput[] = [
    ...(f.themeId ? [{ kind: 'theme' as const, themeId: f.themeId }] : []),
    ...(f.branding ? [{ kind: 'checkout_branding' as const, branding: f.branding }] : []),
    ...f.discounts.map((d) => ({
      kind: 'discount' as const,
      discountId: d.id,
      status: d.status,
    })),
  ]
  return {
    name: f.name.trim(),
    kind: f.kind,
    startsAt: fromLocalInput(f.startsAt),
    endsAt: f.kind === 'event' ? fromLocalInput(f.endsAt) : null,
    endAction: f.endAction,
    notes: f.notes.trim(),
    audience: f.audience
      ? {
          split: f.audience.split,
          traffic: f.audience.traffic,
          marketIds: f.audience.marketIds,
          target: targetOf(f.audience.target),
        }
      : null,
    changes,
  }
}

/** An event with a start needs an end after it. */
export function endProblem(f: RolloutFormState): boolean {
  if (f.kind !== 'event') return false
  const start = fromLocalInput(f.startsAt)
  const end = fromLocalInput(f.endsAt)
  if (!start) return false
  return !end || end <= start
}

type Copy = typeof rolloutsContent

/** "Theme · Checkout · 3 discounts" for the list. */
export function changesSummary(r: RolloutView, copy: Copy): string {
  const discounts = r.changes.filter((c) => c.kind === 'discount').length
  const parts = [
    r.changes.some((c) => c.kind === 'theme') ? copy.summary.theme : null,
    r.changes.some((c) => c.kind === 'checkout_branding') ? copy.summary.checkout : null,
    discounts > 0 ? copy.summary.discounts(discounts) : null,
  ].filter((p): p is string => p !== null)
  if (r.audience) parts.unshift(copy.summary.abTest)
  return parts.length > 0 ? parts.join(' · ') : copy.summary.none
}
