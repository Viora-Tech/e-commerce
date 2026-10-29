/** SOURCE OF TRUTH: rollout input — RolloutSaveSchema, RolloutError, MAX_ROLLOUT_DISCOUNTS
 * WHAT:  What a saved rollout is made of (its name, kind, times, end action and changes) as the
 *        API and MCP take it, and the error a refused rollout change raises.
 * WHY:   One schema for the router, the service and the admin form's types.
 */
import { ROLLOUT_END_ACTIONS, ROLLOUT_KINDS, ROLLOUT_STATUSES } from '@commerce/db'
import { z } from 'zod'
import { CheckoutBrandingSchema } from '../checkout/branding'
import { CommerceError } from '../errors'

/** Most discounts one rollout switches (Shopify's limit). */
const MAX_ROLLOUT_DISCOUNTS = 250

export class RolloutError extends CommerceError {
  constructor(
    code: 'ROLLOUT_NOT_FOUND' | 'ROLLOUT_INVALID' | 'ROLLOUT_CONFLICT' | 'ROLLOUT_STATE',
    message: string,
    storeId?: string,
  ) {
    super(code, message, { storeId })
  }
}

const ChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('theme'), themeId: z.uuid() }),
  z.object({ kind: z.literal('checkout_branding'), branding: CheckoutBrandingSchema }),
  z.object({
    kind: z.literal('discount'),
    discountId: z.uuid(),
    status: z.enum(['active', 'disabled']),
  }),
])
export type RolloutChangeInput = z.input<typeof ChangeSchema>

export const RolloutSaveSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(ROLLOUT_KINDS).default('launch'),
  startsAt: z.coerce.date().nullable().default(null),
  endsAt: z.coerce.date().nullable().default(null),
  endAction: z.enum(ROLLOUT_END_ACTIONS).default('rollback'),
  changes: z
    .array(ChangeSchema)
    .max(MAX_ROLLOUT_DISCOUNTS + 2)
    .default([]),
})
export type RolloutSaveInput = z.input<typeof RolloutSaveSchema>

/** A rollout's status, for the list's filter. */
export const RolloutStatusSchema = z.enum(ROLLOUT_STATUSES)

/** How an event ends: roll back what it changed, or keep it. */
export const RolloutEndActionSchema = z.enum(ROLLOUT_END_ACTIONS)
