import { settingsSecret } from '@commerce/config'
import { permissions } from '@commerce/core'
import {
  AFFILIATE_STATUSES,
  affiliateTotals,
  applyAsAffiliate,
  approveAffiliate,
  approveDueCommissions,
  archiveProgram,
  COMMISSION_STATUSES,
  CommissionRuleSchema,
  cancelPayout,
  clearReview,
  commissionLedger,
  countDueCommissions,
  createPayouts,
  createProgram,
  decideCodeRequest,
  decideCommission,
  defaultProgram,
  getAffiliate,
  getProgram,
  listAffiliates,
  listCodes,
  listPayouts,
  listPrograms,
  markPayoutPaid,
  PROGRAM_SLUG,
  ProgramRulesSchema,
  payoutCandidates,
  payoutsCsv,
  restoreProgram,
  rotateCoupon,
  StoreAffiliateSettingsSchema,
  saveAffiliateSettings,
  saveProgram,
  setAffiliateProgram,
  setAffiliateRate,
  setAffiliateStatus,
  storePart,
  tdsReportCsv,
  topAffiliates,
  totalsByAffiliate,
  updateAffiliateNote,
  withProgramRules,
} from '@commerce/plugin-affiliates/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can, SEARCH_MAX } from '../procedures'

import { affiliateExtrasRouter, program, refusal } from './affiliates-extras'

/** The Affiliates list's search and filter panel. */
const AffiliateListInput = z.object({
  search: z.string().trim().max(SEARCH_MAX).optional(),
  statuses: z.array(z.enum(AFFILIATE_STATUSES)).max(AFFILIATE_STATUSES.length).optional(),
  programIds: z.array(z.uuid()).max(50).optional(),
  joinedFrom: z.iso.datetime().optional(),
  joinedTo: z.iso.datetime().optional(),
  /** Earned (approved and paid commission), both ends included. */
  minEarnedPaise: z.number().int().min(0).optional(),
  maxEarnedPaise: z.number().int().min(0).optional(),
})

/** The Commissions list's search and filter panel. */
const CommissionListInput = z.object({
  search: z.string().trim().max(SEARCH_MAX).optional(),
  statuses: z.array(z.enum(COMMISSION_STATUSES)).max(COMMISSION_STATUSES.length).optional(),
  sources: z
    .array(z.enum(['link', 'coupon', 'lifetime']))
    .max(3)
    .optional(),
  affiliateIds: z.array(z.uuid()).max(50).optional(),
  placedFrom: z.iso.datetime().optional(),
  placedTo: z.iso.datetime().optional(),
  minCommissionPaise: z.number().int().min(0).optional(),
  maxCommissionPaise: z.number().int().min(0).optional(),
  flagged: z.boolean().optional(),
})

/** What the admin shows of an affiliate: never the encrypted payout details. */
function publicAffiliate(a: NonNullable<Awaited<ReturnType<typeof getAffiliate>>>) {
  return {
    id: a.id,
    customerId: a.customerId,
    code: a.code,
    name: a.name,
    email: a.email,
    status: a.status,
    programId: a.programId,
    rateOverride: a.rateOverride,
    social: a.social,
    message: a.message,
    note: a.note,
    couponCode: a.couponCode,
    discountId: a.discountId,
    payoutMethod: a.payoutMethod,
    payoutHint: a.payoutHint,
    hasPan: a.hasPan,
    gstRegistered: a.gstRegistered,
    reviewReasons: a.reviewReasons,
    codeRequest: a.codeRequest,
    answers: a.answers,
    rejectReason: a.rejectReason,
    source: a.source,
    clicks: a.clicks,
    approvedAt: a.approvedAt,
    createdAt: a.createdAt,
  }
}

const Id = z.object({ id: z.uuid() })

const ProgramInput = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().toLowerCase().regex(PROGRAM_SLUG).optional(),
  rules: ProgramRulesSchema,
})

export const affiliatesRouter = {
  ...affiliateExtrasRouter,
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
  /** Store-wide settings: open or paused, link window, hold, minimum payout and TDS. */
  settings: {
    get: can(permissions.MARKETING_READ).handler(async ({ context }) =>
      storePart(await program(context)),
    ),
    save: can(permissions.MARKETING_WRITE)
      .input(StoreAffiliateSettingsSchema)
      .handler(async ({ context, input }) => {
        await program(context)
        return saveAffiliateSettings(context.tx, context.scope.storeId, input)
      }),
  },
  /** Programs: each with its own commission, levels, exclusions, approval, code and signup page. */
  programs: {
    list: can(permissions.MARKETING_READ).handler(async ({ context }) => {
      await program(context)
      return listPrograms(context.tx, context.scope.storeId)
    }),
    get: can(permissions.MARKETING_READ)
      .input(Id)
      .handler(async ({ context, input }) => {
        await program(context)
        const p = await getProgram(context.tx, input.id)
        if (!p) throw new ORPCError('NOT_FOUND', { message: 'Program not found' })
        return p
      }),
    /** A new program; its rules start from what the admin sends (a copy of the default's). */
    create: can(permissions.MARKETING_WRITE)
      .input(ProgramInput)
      .handler(async ({ context, input }) => {
        await program(context)
        return refusal(() => createProgram(context.tx, context.scope.storeId, input))
      }),
    /** Saves a program's name, link and rules; new rules apply to new orders only. */
    save: can(permissions.MARKETING_WRITE)
      .input(ProgramInput.extend({ id: z.uuid() }))
      .handler(async ({ context, input }) => {
        await program(context)
        return refusal(() => saveProgram(context.tx, context.scope.storeId, input.id, input))
      }),
    /** Archives a program and moves its affiliates to another one. */
    archive: can(permissions.MARKETING_WRITE)
      .input(z.object({ id: z.uuid(), moveTo: z.uuid() }))
      .handler(async ({ context, input }) => {
        await program(context)
        return refusal(() =>
          archiveProgram(context.tx, context.scope.storeId, input.id, input.moveTo),
        )
      }),
    /** Opens an archived program again. */
    restore: can(permissions.MARKETING_WRITE)
      .input(Id)
      .handler(async ({ context, input }) => {
        await program(context)
        await restoreProgram(context.tx, input.id)
        return { ok: true }
      }),
  },
  /** Every affiliate (up to 1000), searched and filtered here; the admin pages in the browser. */
  list: can(permissions.MARKETING_READ)
    .input(AffiliateListInput.optional())
    .handler(async ({ context, input }) => {
      await program(context)
      const f = input ?? {}
      const programs = await listPrograms(context.tx, context.scope.storeId)
      const fallback = programs.find((p) => p.isDefault)
      const [rows, totals] = await Promise.all([
        listAffiliates(context.tx, {
          ...f,
          // No program of their own means the default one.
          withoutProgram: fallback !== undefined && (f.programIds ?? []).includes(fallback.id),
        }),
        totalsByAffiliate(context.tx),
      ])
      const nameOf = (id: string | null) =>
        (programs.find((p) => p.id === id) ?? fallback)?.name ?? ''
      return rows
        .map((a) => ({
          ...publicAffiliate(a),
          programName: nameOf(a.programId),
          orders: totals.get(a.id)?.orders ?? 0,
          earnedPaise: totals.get(a.id)?.earnedPaise ?? 0,
          pendingPaise: totals.get(a.id)?.pendingPaise ?? 0,
        }))
        .filter(
          (a) =>
            (f.minEarnedPaise === undefined || a.earnedPaise >= f.minEarnedPaise) &&
            (f.maxEarnedPaise === undefined || a.earnedPaise <= f.maxEarnedPaise),
        )
    }),
  get: can(permissions.MARKETING_READ)
    .input(Id)
    .handler(async ({ context, input }) => {
      await program(context)
      const a = await getAffiliate(context.tx, input.id)
      if (!a) throw new ORPCError('NOT_FOUND', { message: 'Affiliate not found' })
      const [totals, ledger, programs, codes] = await Promise.all([
        affiliateTotals(context.tx, a.id),
        commissionLedger(context.tx, { affiliateId: a.id, limit: 200 }),
        listPrograms(context.tx, context.scope.storeId),
        listCodes(context.tx, a.id),
      ])
      const own = programs.find((p) => p.id === a.programId) ?? programs.find((p) => p.isDefault)
      return {
        affiliate: publicAffiliate(a),
        totals,
        ledger,
        codes,
        program: own ? { id: own.id, name: own.name, rules: own.rules } : null,
        programs: programs
          .filter((p) => !p.archivedAt)
          .map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault })),
      }
    }),
  /** The merchant adds someone by hand (a creator they already work with). */
  add: can(permissions.MARKETING_WRITE)
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        email: z.email().max(254),
        social: z.string().trim().max(200).default(''),
        approve: z.boolean().default(true),
        /** Their program; none means the default. */
        programId: z.uuid().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const settings = await program(context)
      return refusal(async () => {
        const chosen = input.programId
          ? await getProgram(context.tx, input.programId)
          : await defaultProgram(context.tx, context.scope.storeId)
        if (!chosen) throw new ORPCError('NOT_FOUND', { message: 'Program not found' })
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
            programId: chosen.id,
            source: 'added',
          },
          {
            ...withProgramRules(settings, chosen.rules),
            active: true,
            approval: input.approve ? 'auto' : 'manual',
          },
          settingsSecret(),
        )
        return publicAffiliate(row)
      })
    }),
  approve: can(permissions.MARKETING_WRITE)
    .input(Id)
    .handler(async ({ context, input }) => {
      await program(context)
      return refusal(async () =>
        publicAffiliate(await approveAffiliate(context.tx, context.scope.storeId, input.id)),
      )
    }),
  /** Moves an affiliate to another program: new orders earn under it, their code takes its discount. */
  setProgram: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid(), programId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await program(context)
      await refusal(() =>
        setAffiliateProgram(context.tx, context.scope.storeId, input.id, input.programId),
      )
      return { ok: true }
    }),
  /** Gives an affiliate their own default rate, or (null) back to the program's. */
  setRate: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid(), rule: CommissionRuleSchema.nullable() }))
    .handler(async ({ context, input }) => {
      await program(context)
      await refusal(() => setAffiliateRate(context.tx, input.id, input.rule))
      return { ok: true }
    }),
  setStatus: can(permissions.MARKETING_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        status: z.enum(['rejected', 'suspended']),
        /** For a rejection: why, emailed to them. */
        reason: z.string().max(500).default(''),
      }),
    )
    .handler(async ({ context, input }) => {
      await program(context)
      return refusal(async () =>
        publicAffiliate(await setAffiliateStatus(context.tx, input.id, input.status, input.reason)),
      )
    }),
  /** A leaked coupon: the old one stops working and a new one is made. The link is untouched. */
  rotateCoupon: can(permissions.MARKETING_WRITE)
    .input(Id)
    .handler(async ({ context, input }) => {
      await program(context)
      return refusal(async () =>
        publicAffiliate(await rotateCoupon(context.tx, context.scope.storeId, input.id)),
      )
    }),
  /** Approve or decline an affiliate's request for their own code. */
  decideCode: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid(), decision: z.enum(['approve', 'decline']) }))
    .handler(async ({ context, input }) => {
      await program(context)
      return refusal(async () =>
        publicAffiliate(
          await decideCodeRequest(context.tx, context.scope.storeId, input.id, input.decision),
        ),
      )
    }),
  /** "Looks fine": the merchant checked a needs-review affiliate; their payouts go ahead. */
  clearReview: can(permissions.MARKETING_WRITE)
    .input(Id)
    .handler(async ({ context, input }) => {
      await program(context)
      await clearReview(context.tx, input.id)
      return { ok: true }
    }),
  saveNote: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid(), note: z.string().max(2000) }))
    .handler(async ({ context, input }) => {
      await program(context)
      await updateAffiliateNote(context.tx, input.id, input.note)
      return { ok: true }
    }),
  commissions: {
    /** The newest 1000 that match the search and filter panel; the admin pages in the browser. */
    list: can(permissions.MARKETING_READ)
      .input(CommissionListInput.optional())
      .handler(async ({ context, input }) => {
        await program(context)
        return commissionLedger(context.tx, input ?? {})
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
    /** How many commissions are due now, so "Approve due now" is off when there are none. */
    dueCount: can(permissions.MARKETING_READ).handler(async ({ context }) => {
      await program(context)
      return countDueCommissions(context.tx)
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
    /**
     * The quarterly TDS report (26Q): every commission credited in the quarter with the PAN
     * decrypted. Settings-level members only, like the bank file.
     */
    tdsReport: can(permissions.SETTINGS_MANAGE)
      .input(
        z.object({
          fy: z.number().int().min(2020).max(2100),
          quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        }),
      )
      .handler(async ({ context, input }) => {
        const settings = await program(context)
        return { csv: await tdsReportCsv(context.tx, settings, input, settingsSecret()) }
      }),
  },
}
