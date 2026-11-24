/**
 * Loyalty points v2, people and figures (`loyalty.members.*`, `loyalty.referrals.*`,
 * `loyalty.activity`, `loyalty.analytics`, `loyalty.emails`, `loyalty.customer`): the members
 * list with export, import and reset, referrals, the store-wide activity feed, the analytics
 * figures, the email queue and one customer's v2 card. Import and reset change balances that
 * can be money: through MCP they wait for a person (`SENSITIVE_PATHS`).
 */
import {
  exportMembersCsv,
  importPointBalances,
  LOYALTY_REFERRAL_STATUSES,
  listLoyaltyMembers,
  listRedemptions,
  listReferrals,
  loyaltyActivity,
  loyaltyAnalytics,
  loyaltyEmailBacklog,
  parsePointsCsv,
  permissions,
  referralSummary,
  resetAllPoints,
  tierProgress,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_MAX, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { ctxOf, requireInstalled, surface } from './loyalty-common'

/** Most rows one import file may carry (a one-off move from another app). */
const IMPORT_ROWS_MAX = 20_000

export const loyaltyMembersRouter = {
  /** One page of members: name, status, tier, points, lifetime points, total spent. */
  list: can(permissions.CUSTOMERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        tierId: z.union([z.uuid(), z.literal('none')]).optional(),
        status: z.enum(['active', 'excluded', 'all']).default('all'),
        sort: z.enum(['joined', 'lifetime_points', 'total_spent', 'name']).default('joined'),
        dir: z.enum(['asc', 'desc']).default('desc'),
      }),
    )
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      return listLoyaltyMembers(ctxOf(context), input, settings)
    }),
  /** Every member as CSV (email, name, status, tier, points, lifetime_points, total_spent). */
  export: can(permissions.CUSTOMERS_READ).handler(async ({ context }) => {
    const settings = await requireInstalled(context)
    return { csv: await exportMembersCsv(ctxOf(context), settings) }
  }),
  /** Import points balances from CSV (email, points): set each balance, or add to it. */
  import: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        csv: z.string().max(2_000_000),
        mode: z.enum(['set', 'add']),
      }),
    )
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      const parsed = parsePointsCsv(input.csv)
      if (parsed.rows.length > IMPORT_ROWS_MAX) {
        throw new ORPCError('BAD_REQUEST', { message: `At most ${IMPORT_ROWS_MAX} rows per file` })
      }
      const done = await surface(() =>
        importPointBalances(
          ctxOf(context),
          { rows: parsed.rows, mode: input.mode, staffEmail: context.session.user.email },
          settings,
        ),
      )
      return { ...done, errors: parsed.errors }
    }),
  /** Take every member's points to 0 and cancel points on the way. Type RESET to confirm. */
  resetAll: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ confirm: z.literal('RESET') }))
    .handler(async ({ context }) => {
      await requireInstalled(context)
      return resetAllPoints(ctxOf(context), context.session.user.email)
    }),
}

export const loyaltyReferralsRouter = {
  /** The store's referrals newest first, refused ones with their reason. */
  list: can(permissions.CUSTOMERS_READ)
    .input(
      z.object({
        status: z.enum(LOYALTY_REFERRAL_STATUSES).optional(),
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listReferrals(ctxOf(context), input)
    }),
}

export const loyaltyV2ReadRouter = {
  /** Store-wide loyalty activity, newest first (points moves and tier changes). */
  activity: can(permissions.CUSTOMERS_READ)
    .input(
      z.object({
        before: z.coerce.date().nullable().default(null),
        limit: z.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return loyaltyActivity(ctxOf(context), input)
    }),
  /** The program's figures over a date range: member revenue, rewards, points, members. */
  analytics: can(permissions.ANALYTICS_READ)
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      if (input.to <= input.from) {
        throw new ORPCError('BAD_REQUEST', { message: 'The end must be after the start' })
      }
      return loyaltyAnalytics(ctxOf(context), input)
    }),
  /** Loyalty emails per template: waiting to go and sent. */
  emails: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return loyaltyEmailBacklog(ctxOf(context))
  }),
  /** One customer's v2 loyalty card: tier and progress, reward codes, referral code and friends. */
  customer: can(permissions.CUSTOMERS_READ)
    .input(z.object({ customerId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      const ctx = ctxOf(context)
      return {
        tier: await tierProgress(ctx, input.customerId, settings),
        redemptions: (await listRedemptions(ctx, { customerId: input.customerId, perPage: 50 }))
          .rows,
        referral: await referralSummary(ctx, input.customerId),
      }
    }),
}
