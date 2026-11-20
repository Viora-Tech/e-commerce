/** SOURCE OF TRUTH: weekly and monthly report sends — WHAT: on Monday (weekly) and the 1st (monthly) from 9:00 IST, sends the period's performance report by email to each member who turned it on, once per period / WHY: the worker sweeps every few minutes; the claim on `lastSentOn` makes overlapping sweeps and restarts send each report exactly once */
import { store, storeMember } from '@commerce/db'
import type { TemplateData } from '@commerce/notifications'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { permissions } from '../permissions/statement'
import type { MemberReport } from './alert-prefs'
import { type AlertOptions, alertMembers, deliverToMember } from './alerts'
import { performanceReport } from './report-figures'
import { reportDue, reportPeriod } from './report-periods'

const TEMPLATE = {
  weeklyReport: 'staff_weekly_report',
  monthlyReport: 'staff_monthly_report',
} as const
const KIND = { weeklyReport: 'weekly', monthlyReport: 'monthly' } as const

/**
 * Sends `report` to every member with it on (and Orders access) who has not had this period's.
 * Nothing goes before it is due (`reportDue`). Returns how many members it sent to.
 */
export async function sendDueReports(
  ctx: StoreContext,
  report: MemberReport,
  opts: AlertOptions & { now?: Date | undefined },
): Promise<number> {
  const now = opts.now ?? new Date()
  const kind = KIND[report]
  if (!reportDue(kind, now)) return 0
  const period = reportPeriod(kind, now)
  const due = (await alertMembers(ctx.tx, ctx.storeId, report, permissions.ORDERS_READ)).filter(
    (m) => m.prefs[report].email && m.prefs[report].lastSentOn !== period.key,
  )
  if (due.length === 0) return 0

  const built = await performanceReport(ctx, period, { adminUrl: opts.adminUrl })
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const data: TemplateData = {
    storeName: s?.name ?? '',
    customerName: '',
    totalLabel: '',
    lines: [],
    paymentMethodLabel: '',
    actionUrl: built.button.url,
    report: built,
  }

  let sent = 0
  for (const m of due) {
    // The report's object gains `lastSentOn` even when it was saved before the field existed.
    const claimed = await ctx.tx
      .update(storeMember)
      .set({
        notificationPrefs: sql`jsonb_set(${storeMember.notificationPrefs}, ${`{${report}}`}::text[], coalesce(${storeMember.notificationPrefs} -> ${report}, '{}'::jsonb) || jsonb_build_object('lastSentOn', ${period.key}::text))`,
      })
      .where(
        and(
          eq(storeMember.storeId, ctx.storeId),
          eq(storeMember.userId, m.userId),
          ne(
            sql`coalesce(${storeMember.notificationPrefs} -> ${report} ->> 'lastSentOn', '')`,
            period.key,
          ),
        ),
      )
      .returning({ id: storeMember.id })
    if (claimed.length === 0) continue
    // Email only: the WhatsApp switch is ignored even if one was saved.
    await deliverToMember(
      ctx,
      TEMPLATE[report],
      m,
      { ...m.prefs[report], whatsapp: false },
      data,
      opts,
    )
    sent += 1
  }
  return sent
}
