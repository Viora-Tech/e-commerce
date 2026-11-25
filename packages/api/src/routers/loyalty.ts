/**
 * The Loyalty points app (`loyalty.*`): its overview, settings, and a customer's points on the
 * customer page (balance, history, staff adding or removing points, the birthday). Points are
 * store credit, so changing them moves money: through MCP or the API it waits for a person
 * (`SENSITIVE_PATHS` in `mcp/action-catalogue.ts`).
 */
import {
  adjustPoints,
  customerPoints,
  LoyaltySettingsSchema,
  loyaltyOverview,
  loyaltyState,
  permissions,
  StoreCreditError,
  saveLoyaltySettings,
  setCustomerBirthday,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

async function requireInstalled(context: Ctx) {
  const { installed, settings } = await loyaltyState(context.tx, context.scope.storeId)
  if (!installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Loyalty points app first' })
  }
  return settings
}

const ctxOf = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

/** Store credit errors as the API reports them: a missing customer is 404, the rest 400. */
function surface<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((err) => {
    if (err instanceof StoreCreditError) {
      throw new ORPCError(err.reason === 'not_found' ? 'NOT_FOUND' : 'BAD_REQUEST', {
        message: err.message,
      })
    }
    throw err
  })
}

export const loyaltyRouter = {
  /** Points given and taken back in the last days, customers with points and points on the way. */
  overview: can(permissions.CUSTOMERS_READ)
    .input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return loyaltyOverview(ctxOf(context), input.days)
    }),

  /** A customer's points, points expiring soon and on the way, birthday and history. */
  forCustomer: can(permissions.CUSTOMERS_READ)
    .input(
      z.object({
        customerId: z.uuid(),
        // The customer page asks for a few lines at a time ("Show older" asks for more).
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return surface(() => customerPoints(ctxOf(context), input.customerId, input.limit))
    }),

  /** Add (positive) or remove (negative) points with a reason the history shows. */
  adjust: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        customerId: z.uuid(),
        points: z
          .number()
          .int()
          .min(-200_000)
          .max(200_000)
          .refine((n) => n !== 0, 'Enter a number of points'),
        reason: z.string().trim().min(1).max(200),
      }),
    )
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      return surface(() =>
        adjustPoints(
          ctxOf(context),
          { ...input, staffEmail: context.session.user.email },
          settings,
        ),
      )
    }),

  /** Set or clear a customer's birthday (MM-DD) for birthday points. */
  setBirthday: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ customerId: z.uuid(), birthday: z.string().max(10).nullable() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const r = await setCustomerBirthday(ctxOf(context), input.customerId, input.birthday, 'staff')
      if (!r.ok) {
        throw new ORPCError(r.reason === 'not_found' ? 'NOT_FOUND' : 'BAD_REQUEST', {
          message: r.reason === 'not_found' ? 'Customer not found' : 'Pick a real day of the year',
        })
      }
      return r
    }),

  settings: {
    /** The app's numbers: earn rate, expiry, review and birthday points, reminder. */
    get: can(permissions.SETTINGS_READ).handler(({ context }) => requireInstalled(context)),
    /** Save the app's numbers. */
    save: can(permissions.SETTINGS_MANAGE)
      .input(LoyaltySettingsSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveLoyaltySettings(context.tx, context.scope.storeId, input)
      }),
  },
}
