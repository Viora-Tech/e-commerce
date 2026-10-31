import {
  CommerceError,
  listPolicies,
  loadPolicySettings,
  POLICY_TYPES,
  PolicySettingsSchema,
  permissions,
  policyFromTemplate,
  savePolicy,
  savePolicySettings,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

const ctxOf = (context: { tx: StoreTx; scope: { storeId: string } }) => ({
  tx: context.tx,
  storeId: context.scope.storeId,
})

/** Settings → Policies: the five policy pages, the legal name and the grievance officer. */
export const policiesRouter = {
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const ctx = ctxOf(context)
    const policies = await listPolicies(ctx)
    const settings = await loadPolicySettings(ctx)
    return { policies, settings }
  }),

  /** A policy's template filled from the store as it is now; the editor shows it, nothing is saved. */
  template: can(permissions.SETTINGS_READ)
    .input(z.object({ type: z.enum(POLICY_TYPES) }))
    .handler(({ context, input }) => policyFromTemplate(ctxOf(context), input.type)),

  save: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        type: z.enum(POLICY_TYPES),
        title: z.string().trim().max(120),
        body: z.record(z.string(), z.unknown()).nullable(),
        published: z.boolean(),
      }),
    )
    .handler(async ({ context, input }) => {
      try {
        return await savePolicy(ctxOf(context), input)
      } catch (err) {
        // "Fill in [email address] … before showing this policy" reaches the editor's toast.
        if (err instanceof CommerceError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      }
    }),

  saveSettings: can(permissions.SETTINGS_MANAGE)
    .input(PolicySettingsSchema)
    .handler(({ context, input }) => savePolicySettings(ctxOf(context), input)),
}
