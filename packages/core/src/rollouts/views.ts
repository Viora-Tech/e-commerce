/** SOURCE OF TRUTH: rollout reads — listRollouts, getRollout, RolloutView, RolloutChangeView
 * WHAT:  A rollout as the admin and MCP read it: its times and status with each change, labelled
 *        with the theme's name or the discount's title.
 * WHY:   The list, the rollout page and the service's own answers share one shape.
 */
import {
  discount,
  type RolloutAbOutcome,
  type RolloutAudience,
  type RolloutEndAction,
  type RolloutKind,
  type RolloutStatus,
  rollout,
  rolloutChange,
  theme,
} from '@commerce/db'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { RolloutError } from './schema'

/** `label` is the theme's name or the discount's title (null once it is deleted). */
export type RolloutChangeView =
  | { id: string; kind: 'theme'; themeId: string; label: string | null; applied: boolean }
  | { id: string; kind: 'checkout_branding'; branding: unknown; applied: boolean }
  | {
      id: string
      kind: 'discount'
      discountId: string
      status: 'active' | 'disabled'
      label: string | null
      applied: boolean
    }

export type RolloutView = {
  id: string
  name: string
  kind: RolloutKind
  status: RolloutStatus
  startsAt: Date | null
  endsAt: Date | null
  endAction: RolloutEndAction
  startedAt: Date | null
  endedAt: Date | null
  error: string | null
  notes: string
  /** An A/B test's audience; null when the changes go live for everyone. */
  audience: RolloutAudience | null
  /** An ended A/B test: the arm the store kept. */
  abOutcome: RolloutAbOutcome | null
  changes: RolloutChangeView[]
  createdAt: Date
}

/** Rollouts not yet over: they hold their theme, branding and discounts. */
export const UNENDED: RolloutStatus[] = ['draft', 'scheduled', 'active', 'paused']

export type RolloutRow = typeof rollout.$inferSelect
export type ChangeRow = typeof rolloutChange.$inferSelect

/** Theme and discount names by id, for the changes' labels. */
type Labels = Map<string, string>

function changeView(c: ChangeRow, labels: Labels): RolloutChangeView {
  const applied = c.appliedAt !== null
  const label = c.targetId ? (labels.get(c.targetId) ?? null) : null
  if (c.kind === 'theme') {
    return { id: c.id, kind: 'theme', themeId: c.targetId as string, label, applied }
  }
  if (c.kind === 'checkout_branding') {
    return { id: c.id, kind: 'checkout_branding', branding: c.value, applied }
  }
  const status = (c.value as { status?: string })?.status === 'disabled' ? 'disabled' : 'active'
  return { id: c.id, kind: 'discount', discountId: c.targetId as string, status, label, applied }
}

async function labelsOf(ctx: StoreContext, changes: ChangeRow[]): Promise<Labels> {
  const idsOf = (kind: ChangeRow['kind']) =>
    changes.flatMap((c) => (c.kind === kind && c.targetId ? [c.targetId] : []))
  const themeIds = idsOf('theme')
  const discountIds = idsOf('discount')
  const themes = themeIds.length
    ? await ctx.tx
        .select({ id: theme.id, name: theme.name })
        .from(theme)
        .where(inArray(theme.id, themeIds))
    : []
  const discounts = discountIds.length
    ? await ctx.tx
        .select({ id: discount.id, name: discount.title })
        .from(discount)
        .where(inArray(discount.id, discountIds))
    : []
  return new Map([...themes, ...discounts].map((t) => [t.id, t.name]))
}

function view(r: RolloutRow, changes: ChangeRow[], labels: Labels): RolloutView {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    status: r.status,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    endAction: r.endAction,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    error: r.error,
    notes: r.notes,
    audience: r.audience ?? null,
    abOutcome: r.abOutcome ?? null,
    changes: changes.filter((c) => c.rolloutId === r.id).map((c) => changeView(c, labels)),
    createdAt: r.createdAt,
  }
}

export async function changesOf(ctx: StoreContext, ids: string[]): Promise<ChangeRow[]> {
  if (ids.length === 0) return []
  return ctx.tx
    .select()
    .from(rolloutChange)
    .where(inArray(rolloutChange.rolloutId, ids))
    .orderBy(asc(rolloutChange.createdAt), asc(rolloutChange.id))
}

/** The rollout; `lock` holds its row until the transaction ends, so two ticks never apply it twice. */
export async function mustGet(ctx: StoreContext, id: string, lock = false): Promise<RolloutRow> {
  const q = ctx.tx.select().from(rollout).where(eq(rollout.id, id))
  const [r] = lock ? await q.for('update') : await q
  if (!r) throw new RolloutError('ROLLOUT_NOT_FOUND', 'Rollout not found', ctx.storeId)
  return r
}

/** Every rollout, the newest first; `statuses` narrows the list (the page's filter). */
export async function listRollouts(
  ctx: StoreContext,
  statuses: RolloutStatus[] = [],
): Promise<RolloutView[]> {
  const rows = await ctx.tx
    .select()
    .from(rollout)
    .where(statuses.length ? inArray(rollout.status, statuses) : undefined)
    .orderBy(desc(rollout.createdAt))
  const changes = await changesOf(
    ctx,
    rows.map((r) => r.id),
  )
  const labels = await labelsOf(ctx, changes)
  return rows.map((r) => view(r, changes, labels))
}

export async function getRollout(ctx: StoreContext, id: string): Promise<RolloutView> {
  const r = await mustGet(ctx, id)
  const changes = await changesOf(ctx, [r.id])
  return view(r, changes, await labelsOf(ctx, changes))
}
