import {
  archiveRollout,
  createRollout,
  deleteRollout,
  endRollout,
  getRollout,
  listRollouts,
  pauseRollout,
  permissions,
  RolloutEndActionSchema,
  RolloutError,
  RolloutSaveSchema,
  RolloutStatusSchema,
  resumeRollout,
  rolloutConflicts,
  rolloutDiscountOptions,
  rolloutAbResults,
  rolloutHolds,
  rolloutMarketOptions,
  rolloutThemeOptions,
  startRollout,
  updateRollout,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'

type Ctx = { scope: { storeId: string }; tx: StoreTx }
const ctxOf = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

const STATUS: Record<string, 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST'> = {
  ROLLOUT_NOT_FOUND: 'NOT_FOUND',
  ROLLOUT_CONFLICT: 'CONFLICT',
  ROLLOUT_STATE: 'CONFLICT',
  ROLLOUT_INVALID: 'BAD_REQUEST',
}

/** A refused rollout change as its HTTP error, keeping the words the admin shows. */
async function rolloutErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof RolloutError) {
      throw new ORPCError(STATUS[err.code] ?? 'BAD_REQUEST', { message: err.message })
    }
    throw err
  }
}

const read = () => can(permissions.ROLLOUTS_READ)
const manage = () => can(permissions.ROLLOUTS_MANAGE)

const IdSchema = z.object({ id: z.uuid() })

/**
 * Markets → Rollouts: changes to the live theme, the checkout branding and discounts that go
 * live at a set time, for good (launch) or for a period that then rolls back or stays (event).
 */
export const rolloutsRouter = {
  /** Every rollout with its changes, the newest first; `statuses` narrows the list. */
  list: read()
    .input(
      z
        .object({
          statuses: z
            .array(RolloutStatusSchema)
            .max(RolloutStatusSchema.options.length)
            .default([]),
        })
        .default({ statuses: [] }),
    )
    .handler(({ context, input }) => listRollouts(ctxOf(context), input.statuses)),

  /** One rollout with its changes, when it runs and why its last start failed. */
  get: read()
    .input(IdSchema)
    .handler(({ context, input }) => rolloutErrors(() => getRollout(ctxOf(context), input.id))),

  /** Which unended rollout holds each theme, each discount and the checkout branding. */
  holds: read().handler(({ context }) => rolloutHolds(ctxOf(context))),

  /** The theme library, the live theme first: what a rollout can publish. */
  listThemes: read().handler(({ context }) => rolloutThemeOptions(ctxOf(context))),

  /** The store's markets: where an A/B test can be limited to. */
  listMarkets: read().handler(({ context }) => rolloutMarketOptions(ctxOf(context))),

  /** An A/B rollout's numbers per arm and the z-test hint; null without a test. */
  results: read()
    .input(IdSchema)
    .handler(({ context, input }) =>
      rolloutErrors(() => rolloutAbResults(ctxOf(context), input.id)),
    ),

  /** Discounts by title or code, a page at a time: what a rollout can switch on or off. */
  listDiscounts: read()
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(30),
        search: z.string().trim().max(SEARCH_MAX).optional(),
      }),
    )
    .handler(({ context, input }) => rolloutDiscountOptions(ctxOf(context), input)),

  /** Clashes with other rollouts before saving: `block` refuses the save, `warn` is shown with it. */
  checkConflicts: read()
    .input(RolloutSaveSchema.extend({ id: z.uuid().nullable().default(null) }))
    .handler(({ context, input }) =>
      rolloutErrors(() => {
        const { id, ...rollout } = input
        return rolloutConflicts(ctxOf(context), rollout, id)
      }),
    ),

  /** Save a new rollout: a draft without a start or changes, scheduled with both. */
  create: manage()
    .input(RolloutSaveSchema)
    .handler(({ context, input }) =>
      rolloutErrors(() => createRollout(ctxOf(context), input, context.session.user.email)),
    ),

  /** Change a draft or scheduled rollout; a running event changes only its name and end. */
  update: manage()
    .input(RolloutSaveSchema.extend({ id: z.uuid() }))
    .handler(({ context, input }) =>
      rolloutErrors(() => {
        const { id, ...rollout } = input
        return updateRollout(ctxOf(context), id, rollout)
      }),
    ),

  /** Apply a rollout's changes now instead of at its start; a launch ends at once. */
  startNow: manage()
    .input(IdSchema)
    .handler(({ context, input }) => rolloutErrors(() => startRollout(ctxOf(context), input.id))),

  /** Roll a running event back early; resume applies it again. */
  pause: manage()
    .input(IdSchema)
    .handler(({ context, input }) => rolloutErrors(() => pauseRollout(ctxOf(context), input.id))),

  /** Apply a paused event's changes again until its end. */
  resume: manage()
    .input(IdSchema)
    .handler(({ context, input }) => rolloutErrors(() => resumeRollout(ctxOf(context), input.id))),

  /**
   * End a running event now: roll back what it changed, or keep its changes for good. An A/B
   * test: `apply` ships the Treatment to everyone, `rollback` keeps the Control.
   */
  end: manage()
    .input(IdSchema.extend({ action: RolloutEndActionSchema }))
    .handler(({ context, input }) =>
      rolloutErrors(() => endRollout(ctxOf(context), input.id, input.action)),
    ),

  /** Keep a rollout that is not running for the record only. */
  archive: manage()
    .input(IdSchema)
    .handler(({ context, input }) => rolloutErrors(() => archiveRollout(ctxOf(context), input.id))),

  /** Delete a rollout that is not running, with its changes. */
  delete: manage()
    .input(IdSchema)
    .handler(({ context, input }) =>
      rolloutErrors(async () => {
        await deleteRollout(ctxOf(context), input.id)
        return { ok: true as const }
      }),
    ),
}
