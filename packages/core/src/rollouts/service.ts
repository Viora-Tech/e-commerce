/** SOURCE OF TRUTH: rollout service — listRollouts, getRollout, createRollout, updateRollout,
 *   startRollout, endRollout, pauseRollout, resumeRollout, archiveRollout, deleteRollout,
 *   rolloutConflicts, RolloutError
 * WHAT:  Markets → Rollouts (Shopify's): a set of changes (the live theme, the checkout branding,
 *        discounts on or off) that goes live at a set time, for good (launch) or for a period
 *        that then rolls back or stays (event). Saving checks conflicts with other rollouts;
 *        starting applies every change in one transaction or none.
 * WHY:   A sale prepared ahead goes live at midnight with nobody clicking, and ends exactly where
 *        the store was. Design: docs/superpowers/specs/2026-10-28-rollouts-r1-design.md.
 */
import {
  discount,
  type RolloutAudience,
  type RolloutEndAction,
  type RolloutKind,
  type RolloutStatus,
  rollout,
  rolloutChange,
  theme,
} from '@commerce/db'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { z } from 'zod'
import type { StoreContext } from '../context'
import {
  applyRolloutChange,
  RolloutChangeError,
  revertRolloutChange,
  type StoredRolloutChange,
} from './changes'
import {
  AB_SPLITTABLE_KINDS,
  RolloutError,
  type RolloutSaveInput,
  RolloutSaveSchema,
} from './schema'
import { type ChangeRow, changesOf, getRollout, mustGet, type RolloutView, UNENDED } from './views'

export { getRollout, listRollouts, type RolloutChangeView, type RolloutView } from './views'

/** A clash with another rollout: `block` stops the save, `warn` is shown with it. */
export type RolloutConflict = {
  level: 'block' | 'warn'
  rolloutId: string
  rolloutName: string
  message: string
}

type Parsed = z.output<typeof RolloutSaveSchema>

/** Draft without a start or without changes; scheduled otherwise. */
const statusFor = (p: Parsed): RolloutStatus =>
  p.startsAt && p.changes.length > 0 ? 'scheduled' : 'draft'

function validate(p: Parsed, storeId: string): void {
  const themes = p.changes.filter((c) => c.kind === 'theme').length
  const branding = p.changes.filter((c) => c.kind === 'checkout_branding').length
  const discounts = p.changes.filter((c) => c.kind === 'discount')
  if (themes > 1)
    throw new RolloutError('ROLLOUT_INVALID', 'Only one theme change per rollout', storeId)
  if (branding > 1) {
    throw new RolloutError('ROLLOUT_INVALID', 'Only one checkout change per rollout', storeId)
  }
  if (new Set(discounts.map((d) => d.discountId)).size !== discounts.length) {
    throw new RolloutError('ROLLOUT_INVALID', 'A discount is listed twice', storeId)
  }
  if (p.audience) {
    const splittable: readonly string[] = AB_SPLITTABLE_KINDS
    if (p.changes.some((c) => !splittable.includes(c.kind))) {
      throw new RolloutError(
        'ROLLOUT_INVALID',
        'An A/B test can split theme changes only. Remove the checkout and discount changes, or turn the test off.',
        storeId,
      )
    }
  }
  if (p.kind === 'event' && p.startsAt && !p.endsAt) {
    throw new RolloutError('ROLLOUT_INVALID', 'An event needs an end date', storeId)
  }
  if (p.kind === 'event' && p.startsAt && p.endsAt && p.endsAt <= p.startsAt) {
    throw new RolloutError('ROLLOUT_INVALID', 'The end must be after the start', storeId)
  }
}

/**
 * When a rollout holds its change: an event from start to end; a launch at its start; an A/B
 * test from its start until it ends (a launch's test runs until the merchant picks an arm).
 */
function windowOf(r: {
  kind: RolloutKind
  startsAt: Date | null
  endsAt: Date | null
  audience?: RolloutAudience | null
}) {
  if (!r.startsAt) return null
  const end =
    r.kind === 'event' || r.audience
      ? ((r.kind === 'event' ? r.endsAt : null) ?? new Date(8.64e15))
      : r.startsAt
  return { start: r.startsAt.getTime(), end: end.getTime() }
}

const overlaps = (
  a: { start: number; end: number } | null,
  b: { start: number; end: number } | null,
): boolean => a !== null && b !== null && a.start <= b.end && b.start <= a.end

/**
 * Other unended rollouts this one clashes with. Blocking: a discount already in another
 * rollout; a theme or checkout change overlapping another rollout's theme or checkout change.
 * Warning: the theme to publish is gone (it is checked again at the start).
 */
export async function rolloutConflicts(
  ctx: StoreContext,
  input: RolloutSaveInput,
  selfId: string | null = null,
): Promise<RolloutConflict[]> {
  const p = RolloutSaveSchema.parse(input)
  const others = await ctx.tx
    .select()
    .from(rollout)
    .where(and(inArray(rollout.status, UNENDED), selfId ? ne(rollout.id, selfId) : undefined))
  const changes = await changesOf(
    ctx,
    others.map((o) => o.id),
  )
  const mine = windowOf(p)
  const out: RolloutConflict[] = []
  for (const o of others) {
    const theirs = changes.filter((c) => c.rolloutId === o.id)
    for (const c of p.changes) {
      if (
        c.kind === 'discount' &&
        theirs.some((t) => t.kind === 'discount' && t.targetId === c.discountId)
      ) {
        out.push({
          level: 'block',
          rolloutId: o.id,
          rolloutName: o.name,
          message: `A discount here is already in “${o.name}”.`,
        })
      }
      if (
        (c.kind === 'theme' || c.kind === 'checkout_branding') &&
        theirs.some((t) => t.kind === c.kind) &&
        overlaps(mine, windowOf(o))
      ) {
        out.push({
          level: 'block',
          rolloutId: o.id,
          rolloutName: o.name,
          message:
            c.kind === 'theme'
              ? `“${o.name}” changes the theme at the same time.`
              : `“${o.name}” changes the checkout at the same time.`,
        })
      }
    }
  }
  const themeChange = p.changes.find((c) => c.kind === 'theme')
  if (themeChange) {
    const [t] = await ctx.tx
      .select({ id: theme.id })
      .from(theme)
      .where(eq(theme.id, themeChange.themeId))
    if (!t) {
      out.push({
        level: 'warn',
        rolloutId: '',
        rolloutName: '',
        message: 'The theme to publish no longer exists.',
      })
    }
  }
  const ids = p.changes.flatMap((c) => (c.kind === 'discount' ? [c.discountId] : []))
  if (ids.length > 0) {
    const found = await ctx.tx
      .select({ id: discount.id })
      .from(discount)
      .where(inArray(discount.id, ids))
    if (found.length !== new Set(ids).size) {
      throw new RolloutError(
        'ROLLOUT_INVALID',
        'A discount in this rollout does not exist',
        ctx.storeId,
      )
    }
  }
  // One message per clash, not one per discount.
  return out.filter(
    (c, i) => out.findIndex((x) => x.rolloutId === c.rolloutId && x.message === c.message) === i,
  )
}

async function writeChanges(ctx: StoreContext, rolloutId: string, p: Parsed): Promise<void> {
  await ctx.tx.delete(rolloutChange).where(eq(rolloutChange.rolloutId, rolloutId))
  if (p.changes.length === 0) return
  await ctx.tx.insert(rolloutChange).values(
    p.changes.map((c) => ({
      storeId: ctx.storeId,
      rolloutId,
      kind: c.kind,
      targetId: c.kind === 'theme' ? c.themeId : c.kind === 'discount' ? c.discountId : null,
      value:
        c.kind === 'checkout_branding'
          ? c.branding
          : c.kind === 'discount'
            ? { status: c.status }
            : {},
    })),
  )
}

async function refuseBlocking(
  ctx: StoreContext,
  input: RolloutSaveInput,
  selfId: string | null,
): Promise<void> {
  const blocking = (await rolloutConflicts(ctx, input, selfId)).filter((c) => c.level === 'block')
  if (blocking[0]) throw new RolloutError('ROLLOUT_CONFLICT', blocking[0].message, ctx.storeId)
}

export async function createRollout(
  ctx: StoreContext,
  input: RolloutSaveInput,
  createdBy: string | null = null,
): Promise<RolloutView> {
  const p = RolloutSaveSchema.parse(input)
  validate(p, ctx.storeId)
  await refuseBlocking(ctx, input, null)
  const [r] = await ctx.tx
    .insert(rollout)
    .values({
      storeId: ctx.storeId,
      name: p.name,
      kind: p.kind,
      status: statusFor(p),
      startsAt: p.startsAt,
      endsAt: p.kind === 'event' ? p.endsAt : null,
      endAction: p.endAction,
      notes: p.notes,
      audience: p.audience,
      createdBy,
    })
    .returning()
  if (!r) throw new RolloutError('ROLLOUT_INVALID', 'Rollout not saved', ctx.storeId)
  await writeChanges(ctx, r.id, p)
  return getRollout(ctx, r.id)
}

/**
 * Drafts and scheduled rollouts change freely; an active one only its name, end (time and
 * action), notes and an A/B test's target: the split, traffic and markets stay as the test
 * started, or its numbers would mix two audiences.
 */
export async function updateRollout(
  ctx: StoreContext,
  id: string,
  input: RolloutSaveInput,
): Promise<RolloutView> {
  const r = await mustGet(ctx, id)
  const p = RolloutSaveSchema.parse(input)
  validate(p, ctx.storeId)
  if (r.status === 'active' || r.status === 'paused') {
    if (p.endsAt && r.startedAt && p.endsAt <= r.startedAt) {
      throw new RolloutError('ROLLOUT_INVALID', 'The end must be after the start', ctx.storeId)
    }
    await ctx.tx
      .update(rollout)
      .set({
        name: p.name,
        endsAt: p.endsAt,
        endAction: p.endAction,
        notes: p.notes,
        audience:
          r.audience && p.audience ? { ...r.audience, target: p.audience.target } : r.audience,
      })
      .where(eq(rollout.id, id))
    return getRollout(ctx, id)
  }
  if (r.status !== 'draft' && r.status !== 'scheduled') {
    throw new RolloutError('ROLLOUT_STATE', 'An ended rollout cannot change', ctx.storeId)
  }
  await refuseBlocking(ctx, input, id)
  await ctx.tx
    .update(rollout)
    .set({
      name: p.name,
      kind: p.kind,
      status: statusFor(p),
      startsAt: p.startsAt,
      endsAt: p.kind === 'event' ? p.endsAt : null,
      endAction: p.endAction,
      notes: p.notes,
      audience: p.audience,
      error: null,
    })
    .where(eq(rollout.id, id))
  await writeChanges(ctx, id, p)
  return getRollout(ctx, id)
}

const stored = (c: ChangeRow): StoredRolloutChange => ({
  id: c.id,
  kind: c.kind,
  targetId: c.targetId,
  value: c.value,
  previous: c.previous,
})

/**
 * Applies a scheduled (or paused) rollout's changes now, all in this transaction. A launch ends
 * at once (its changes stay); an event becomes active. A change that cannot apply (its theme was
 * deleted) leaves the rollout a draft with the reason, and nothing changed.
 */
export async function startRollout(
  ctx: StoreContext,
  id: string,
  at = new Date(),
): Promise<RolloutView> {
  const r = await mustGet(ctx, id, true)
  if (r.status !== 'scheduled' && r.status !== 'draft') {
    throw new RolloutError('ROLLOUT_STATE', 'Only a scheduled rollout can start', ctx.storeId)
  }
  const changes = await changesOf(ctx, [id])
  if (changes.length === 0) {
    throw new RolloutError('ROLLOUT_INVALID', 'Add a change before starting', ctx.storeId)
  }
  if (r.kind === 'event' && (!r.endsAt || r.endsAt <= at)) {
    throw new RolloutError('ROLLOUT_INVALID', 'An event needs an end after now', ctx.storeId)
  }
  if (r.audience) {
    // An A/B test changes nothing on the store: the storefront draws the Treatment's theme for
    // its visitors only. It needs that theme to exist, like a publish would.
    await treatmentThemeMustExist(ctx, changes)
    await ctx.tx
      .update(rollout)
      .set({ status: 'active', startsAt: r.startsAt ?? at, startedAt: at, error: null })
      .where(eq(rollout.id, id))
    return getRollout(ctx, id)
  }
  try {
    for (const c of changes) await applyRolloutChange(ctx, stored(c), at)
  } catch (e) {
    if (!(e instanceof RolloutChangeError)) throw e
    throw new RolloutError('ROLLOUT_INVALID', e.message, ctx.storeId)
  }
  await ctx.tx
    .update(rollout)
    .set(
      r.kind === 'launch'
        ? { status: 'ended', startsAt: r.startsAt ?? at, startedAt: at, endedAt: at, error: null }
        : { status: 'active', startsAt: r.startsAt ?? at, startedAt: at, error: null },
    )
    .where(eq(rollout.id, id))
  return getRollout(ctx, id)
}

async function treatmentThemeMustExist(ctx: StoreContext, changes: ChangeRow[]): Promise<void> {
  const change = changes.find((c) => c.kind === 'theme')
  if (!change?.targetId) {
    throw new RolloutError('ROLLOUT_INVALID', 'Add a theme for the Treatment to see', ctx.storeId)
  }
  const [t] = await ctx.tx.select({ id: theme.id }).from(theme).where(eq(theme.id, change.targetId))
  if (!t) {
    throw new RolloutError(
      'ROLLOUT_INVALID',
      'The theme this rollout publishes was deleted.',
      ctx.storeId,
    )
  }
}

/** Records why a due start failed and turns the rollout back into a draft (the tick moves on). */
export async function failRollout(ctx: StoreContext, id: string, reason: string): Promise<void> {
  await ctx.tx.update(rollout).set({ status: 'draft', error: reason }).where(eq(rollout.id, id))
}

/**
 * Ends an active (or paused) event: `rollback` puts back what it replaced (where the store still
 * shows the rollout's change), `apply` keeps everything. Applied changes cannot be undone later.
 */
export async function endRollout(
  ctx: StoreContext,
  id: string,
  action: RolloutEndAction,
  at = new Date(),
): Promise<RolloutView> {
  const r = await mustGet(ctx, id, true)
  if (r.status !== 'active' && r.status !== 'paused') {
    throw new RolloutError('ROLLOUT_STATE', 'Only an active rollout can end', ctx.storeId)
  }
  if (r.audience) {
    // A test applied nothing: "Ship Treatment" (apply) publishes its changes for everyone now,
    // "Keep Control" (rollback) leaves the store as it is.
    if (action === 'apply') {
      try {
        for (const c of await changesOf(ctx, [id])) await applyRolloutChange(ctx, stored(c), at)
      } catch (e) {
        if (!(e instanceof RolloutChangeError)) throw e
        throw new RolloutError('ROLLOUT_INVALID', e.message, ctx.storeId)
      }
    }
    await ctx.tx
      .update(rollout)
      .set({
        status: 'ended',
        endedAt: at,
        endAction: action,
        abOutcome: action === 'apply' ? 'treatment' : 'control',
      })
      .where(eq(rollout.id, id))
    return getRollout(ctx, id)
  }
  if (r.status === 'active' && action === 'rollback') {
    for (const c of await changesOf(ctx, [id])) {
      if (c.appliedAt) await revertRolloutChange(ctx, stored(c))
    }
  }
  if (r.status === 'paused' && action === 'apply') {
    for (const c of await changesOf(ctx, [id])) await applyRolloutChange(ctx, stored(c), at)
  }
  await ctx.tx
    .update(rollout)
    .set({ status: 'ended', endedAt: at, endAction: action })
    .where(eq(rollout.id, id))
  return getRollout(ctx, id)
}

/** Rolls an active event back early; `resumeRollout` applies it again. */
export async function pauseRollout(ctx: StoreContext, id: string): Promise<RolloutView> {
  const r = await mustGet(ctx, id)
  if (r.status !== 'active' || (r.kind !== 'event' && !r.audience)) {
    throw new RolloutError('ROLLOUT_STATE', 'Only an active event can pause', ctx.storeId)
  }
  // A paused A/B test shows everyone the Control; nothing was applied, so nothing rolls back.
  for (const c of r.audience ? [] : await changesOf(ctx, [id])) {
    if (c.appliedAt) await revertRolloutChange(ctx, stored(c))
  }
  await ctx.tx.update(rollout).set({ status: 'paused' }).where(eq(rollout.id, id))
  return getRollout(ctx, id)
}

export async function resumeRollout(
  ctx: StoreContext,
  id: string,
  at = new Date(),
): Promise<RolloutView> {
  const r = await mustGet(ctx, id)
  if (r.status !== 'paused') {
    throw new RolloutError('ROLLOUT_STATE', 'Only a paused rollout can resume', ctx.storeId)
  }
  if (r.endsAt && r.endsAt <= at) {
    throw new RolloutError('ROLLOUT_STATE', 'This event’s end has passed', ctx.storeId)
  }
  try {
    if (r.audience) await treatmentThemeMustExist(ctx, await changesOf(ctx, [id]))
    else for (const c of await changesOf(ctx, [id])) await applyRolloutChange(ctx, stored(c), at)
  } catch (e) {
    if (!(e instanceof RolloutChangeError)) throw e
    throw new RolloutError('ROLLOUT_INVALID', e.message, ctx.storeId)
  }
  await ctx.tx.update(rollout).set({ status: 'active' }).where(eq(rollout.id, id))
  return getRollout(ctx, id)
}

/** Keeps an ended, draft or scheduled rollout for the record only; an active one cannot. */
export async function archiveRollout(ctx: StoreContext, id: string): Promise<RolloutView> {
  const r = await mustGet(ctx, id)
  if (r.status === 'active') {
    throw new RolloutError('ROLLOUT_STATE', 'End the rollout before archiving it', ctx.storeId)
  }
  await ctx.tx.update(rollout).set({ status: 'archived' }).where(eq(rollout.id, id))
  return getRollout(ctx, id)
}

/** Deletes a rollout that is not running; its changes go with it. */
export async function deleteRollout(ctx: StoreContext, id: string): Promise<void> {
  const r = await mustGet(ctx, id)
  if (r.status === 'active') {
    throw new RolloutError('ROLLOUT_STATE', 'End the rollout before deleting it', ctx.storeId)
  }
  await ctx.tx.delete(rollout).where(eq(rollout.id, id))
}
