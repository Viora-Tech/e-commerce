import { settingsSecret } from '@commerce/config'
import { CommerceError, permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  AffiliateSettingsSchema,
  affiliateState,
  affiliateTotals,
  applyAsAffiliate,
  approveAffiliate,
  approveDueCommissions,
  cancelPayout,
  commissionLedger,
  createPayouts,
  decideCommission,
  getAffiliate,
  listAffiliates,
  listPayouts,
  markPayoutPaid,
  payoutCandidates,
  payoutsCsv,
  saveAffiliateSettings,
  setAffiliateStatus,
  topAffiliates,
  totalsByAffiliate,
  updateAffiliateNote,
} from '@commerce/plugin-affiliates/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can } from '../procedures'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

/** The program, after checking the store installed the app. */
async function program(context: Ctx) {
  const state = await affiliateState(context.tx, context.scope.storeId)
  if (!state.installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Affiliates app first' })
  }
  return state.settings
}

/** An app refusal ("not waiting to be paid") reaches the admin as its own words. */
async function refusal<T>(fn: () => Promise<T>): Promise<T> {
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

/** What the admin shows of an affiliate: never the encrypted payout details. */
function publicAffiliate(a: NonNullable<Awaited<ReturnType<typeof getAffiliate>>>) {
  return {
    id: a.id,
    customerId: a.customerId,
    code: a.code,
    name: a.name,
    email: a.email,
    status: a.status,
    social: a.social,
    message: a.message,
    note: a.note,
    couponCode: a.couponCode,
    discountId: a.discountId,
    payoutMethod: a.payoutMethod,
    payoutHint: a.payoutHint,
    hasPan: a.hasPan,
    clicks: a.clicks,
    approvedAt: a.approvedAt,
    createdAt: a.createdAt,
  }
}

const Id = z.object({ id: z.uuid() })

export const affiliatesRouter = {
  /** Sales from affiliates, money owed, the best affiliates and who is waiting to be paid. */
  overview: can(permissions.MARKETING_READ).handler(async ({ context }) => {
    const settings = await program(context)
    const [totals, top, candidates, affiliates] = await Promise.all([
      affiliateTotals(context.tx),
      topAffiliates(context.tx, 5),
      payoutCandidates(context.tx, settings),
      listAffiliates(context.tx),
    ])
    return {
      totals,
      top,
      readyToPay: candidates.filter((c) => c.ready).length,
      waitingApproval: affiliates.filter((a) => a.status === 'pending').length,
      approved: affiliates.filter((a) => a.status === 'approved').length,
      active: settings.active,
    }
  }),
  settings: {
    get: can(permissions.MARKETING_READ).handler(async ({ context }) => program(context)),
    save: can(permissions.MARKETING_WRITE)
      .input(AffiliateSettingsSchema)
      .handler(async ({ context, input }) => {
        await program(context)
        return saveAffiliateSettings(context.tx, context.scope.storeId, input)
      }),
  },
  list: can(permissions.MARKETING_READ).handler(async ({ context }) => {
    await program(context)
    const [rows, totals] = await Promise.all([
      listAffiliates(context.tx),
      totalsByAffiliate(context.tx),
    ])
    return rows.map((a) => ({
      ...publicAffiliate(a),
      orders: totals.get(a.id)?.orders ?? 0,
      earnedPaise: totals.get(a.id)?.earnedPaise ?? 0,
      pendingPaise: totals.get(a.id)?.pendingPaise ?? 0,
    }))
  }),
  get: can(permissions.MARKETING_READ)
    .input(Id)
    .handler(async ({ context, input }) => {
      await program(context)
      const a = await getAffiliate(context.tx, input.id)
      if (!a) throw new ORPCError('NOT_FOUND', { message: 'Affiliate not found' })
      const [totals, ledger] = await Promise.all([
        affiliateTotals(context.tx, a.id),
        commissionLedger(context.tx, { affiliateId: a.id, limit: 200 }),
      ])
      return { affiliate: publicAffiliate(a), totals, ledger }
    }),
  /** The merchant adds someone by hand (a creator they already work with). */
  add: can(permissions.MARKETING_WRITE)
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        email: z.email().max(254),
        social: z.string().trim().max(200).default(''),
        approve: z.boolean().default(true),
      }),
    )
    .handler(async ({ context, input }) => {
      const settings = await program(context)
      return refusal(async () => {
        const row = await applyAsAffiliate(
          context.tx,
          context.scope.storeId,
          {
            customerId: null,
            email: input.email,
            phone: null,
            name: input.name,
            social: input.social,
            message: '',
          },
          { ...settings, active: true, approval: input.approve ? 'auto' : 'manual' },
          settingsSecret(),
        )
        return publicAffiliate(row)
      })
    }),
  approve: can(permissions.MARKETING_WRITE)
    .input(Id)
    .handler(async ({ context, input }) => {
      const settings = await program(context)
      return refusal(async () =>
        publicAffiliate(
          await approveAffiliate(context.tx, context.scope.storeId, input.id, settings),
        ),
      )
    }),
  setStatus: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid(), status: z.enum(['rejected', 'suspended']) }))
    .handler(async ({ context, input }) => {
      await program(context)
      return refusal(async () =>
        publicAffiliate(await setAffiliateStatus(context.tx, input.id, input.status)),
      )
    }),
  saveNote: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid(), note: z.string().max(2000) }))
    .handler(async ({ context, input }) => {
      await program(context)
      await updateAffiliateNote(context.tx, input.id, input.note)
      return { ok: true }
    }),
  commissions: {
    list: can(permissions.MARKETING_READ).handler(async ({ context }) => {
      await program(context)
      return commissionLedger(context.tx)
    }),
    /** Clear a fraud flag (back to pending) or refuse a commission. */
    decide: can(permissions.MARKETING_WRITE)
      .input(z.object({ id: z.uuid(), decision: z.enum(['clear', 'reverse']) }))
      .handler(async ({ context, input }) => {
        const settings = await program(context)
        const row = await decideCommission(
          context.tx,
          context.scope.storeId,
          input.id,
          input.decision,
          settings,
        )
        if (!row) throw new ORPCError('NOT_FOUND', { message: 'Commission not found' })
        return { id: row.id, status: row.status }
      }),
    /** Approves every commission whose hold is over now, instead of waiting for the hourly pass. */
    approveDue: can(permissions.MARKETING_WRITE).handler(async ({ context }) => {
      const settings = await program(context)
      return approveDueCommissions(context.tx, context.scope.storeId, settings)
    }),
  },
  payouts: {
    list: can(permissions.MARKETING_READ).handler(async ({ context }) => {
      await program(context)
      return listPayouts(context.tx)
    }),
    candidates: can(permissions.MARKETING_READ).handler(async ({ context }) =>
      payoutCandidates(context.tx, await program(context)),
    ),
    create: can(permissions.MARKETING_WRITE)
      .input(z.object({ affiliateIds: z.array(z.uuid()).max(BULK_MAX).optional() }))
      .handler(async ({ context, input }) => {
        const settings = await program(context)
        const made = await createPayouts(
          context.tx,
          context.scope.storeId,
          settings,
          input.affiliateIds,
        )
        return { created: made.length }
      }),
    markPaid: can(permissions.MARKETING_WRITE)
      .input(z.object({ id: z.uuid(), reference: z.string().trim().max(120).default('') }))
      .handler(async ({ context, input }) => {
        await program(context)
        return refusal(async () => {
          const p = await markPayoutPaid(
            context.tx,
            context.scope.storeId,
            input.id,
            input.reference,
          )
          return { id: p.id, status: p.status }
        })
      }),
    cancel: can(permissions.MARKETING_WRITE)
      .input(Id)
      .handler(async ({ context, input }) => {
        await program(context)
        await refusal(() => cancelPayout(context.tx, input.id))
        return { ok: true }
      }),
    /**
     * The bank bulk-upload file for pending payouts, account numbers and UPI IDs decrypted.
     * Settings-level members only: it holds every affiliate's bank details.
     */
    exportCsv: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ ids: z.array(z.uuid()).max(BULK_MAX).optional() }))
      .handler(async ({ context, input }) => {
        await program(context)
        return { csv: await payoutsCsv(context.tx, settingsSecret(), input.ids) }
      }),
  },
}
