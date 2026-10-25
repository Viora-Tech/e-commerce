/** SOURCE OF TRUTH: the Affiliates router's reports, creatives and blocklist — WHAT: trends and top products, the ledger CSV, creatives (list, save, hide), the blocklist (list, add, remove), and the shared install check and refusal mapping / WHY: kept beside `affiliates.ts` so neither file passes the 500-line cap */

import { settingsSecret } from '@commerce/config'
import { CommerceError, permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  addToBlocklist,
  affiliateState,
  affiliateTrend,
  archiveCreative,
  BLOCKLIST_KINDS,
  ledgerCsv,
  listBlocklist,
  listCreatives,
  removeFromBlocklist,
  saveCreative,
  topProducts,
} from '@commerce/plugin-affiliates/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

/** The program, after checking the store installed the app. */
export async function program(context: Ctx) {
  const state = await affiliateState(context.tx, context.scope.storeId)
  if (!state.installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Affiliates app first' })
  }
  return state.settings
}

/** An app refusal ("not waiting to be paid") reaches the admin as its own words. */
export async function refusal<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof CommerceError) {
      const code = err.code.endsWith('NOT_FOUND') ? 'NOT_FOUND' : 'PRECONDITION_FAILED'
      throw new ORPCError(code, { message: err.message })
    }
    throw err
  }
}

const Id = z.object({ id: z.uuid() })

export const affiliateExtrasRouter = {
  /** Sales, commission and clicks per week or month (last 12), with the products affiliates sell most. */
  trend: can(permissions.MARKETING_READ)
    .input(
      z.object({ by: z.enum(['week', 'month']).default('week'), programId: z.uuid().optional() }),
    )
    .handler(async ({ context, input }) => {
      await program(context)
      const [points, products] = await Promise.all([
        affiliateTrend(context.tx, { by: input.by, programId: input.programId }),
        topProducts(context.tx, { programId: input.programId, limit: 10 }),
      ])
      return { points, products }
    }),
  /** The commissions ledger as CSV, for the merchant's books. */
  ledgerCsv: can(permissions.MARKETING_READ).handler(async ({ context }) => {
    await program(context)
    return { csv: await ledgerCsv(context.tx) }
  }),
  /** Images and captions for affiliates to post, per program or for all. */
  creatives: {
    list: can(permissions.MARKETING_READ).handler(async ({ context }) => {
      await program(context)
      return listCreatives(context.tx, { archived: true })
    }),
    save: can(permissions.MARKETING_WRITE)
      .input(
        z.object({
          id: z.uuid().optional(),
          mediaId: z.uuid(),
          programId: z.uuid().nullable().default(null),
          title: z.string().max(120).default(''),
          caption: z.string().max(2200).default(''),
        }),
      )
      .handler(async ({ context, input }) => {
        await program(context)
        return refusal(() => saveCreative(context.tx, context.scope.storeId, input))
      }),
    archive: can(permissions.MARKETING_WRITE)
      .input(z.object({ id: z.uuid(), archived: z.boolean() }))
      .handler(async ({ context, input }) => {
        await program(context)
        await archiveCreative(context.tx, input.id, input.archived)
        return { ok: true }
      }),
  },
  /** Blocked emails, domains, phones, IPs, PANs and payees: buyers held, applicants refused. */
  blocklist: {
    list: can(permissions.MARKETING_READ).handler(async ({ context }) => {
      await program(context)
      return listBlocklist(context.tx)
    }),
    add: can(permissions.MARKETING_WRITE)
      .input(
        z.object({
          kind: z.enum(BLOCKLIST_KINDS),
          value: z.string().trim().min(1).max(200),
          note: z.string().max(200).default(''),
        }),
      )
      .handler(async ({ context, input }) => {
        await program(context)
        return refusal(() =>
          addToBlocklist(
            context.tx,
            context.scope.storeId,
            input,
            context.scope.userId,
            settingsSecret(),
          ),
        )
      }),
    remove: can(permissions.MARKETING_WRITE)
      .input(Id)
      .handler(async ({ context, input }) => {
        await program(context)
        await removeFromBlocklist(context.tx, input.id)
        return { ok: true }
      }),
  },
}
