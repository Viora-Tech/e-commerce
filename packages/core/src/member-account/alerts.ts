/** SOURCE OF TRUTH: member alert delivery — WHAT: reads and saves a team member's alert choices, finds who should hear about a new order or get today's summary, and sends it to them by email or WhatsApp through the store's channels / WHY: the store-wide messages go to customers or the store's contact address; these go to each person who asked, and only to people whose role may see orders */
import { dayKey, startOfDay, wallClock } from '@commerce/dates'
import { authSchema, notification, order, type StoreTx, store, storeMember } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData, TemplateId } from '@commerce/notifications'
import { and, count, eq, gte, inArray, lt, ne, notInArray, sql, sum } from 'drizzle-orm'
import type { StoreContext } from '../context'
import {
  buildTemplateData,
  channelsFor,
  type DeliverOptions,
  type DeliveryResult,
  messageOn,
} from '../notifications/deliver'
import { UNFULFILLED_STATUSES, UNPAID_PAYMENT_STATUSES } from '../order/aggregate-status'
import { memberAccess } from '../permissions/service'
import { type Permission, permissions } from '../permissions/statement'
import {
  type AlertSwitches,
  alertOn,
  type MemberAlert,
  type MemberAlertPrefs,
  type MemberAlertPrefsInput,
  parseMemberAlertPrefs,
} from './alert-prefs'

/** A member's alert choices for this store; the defaults until they save. */
export async function loadMemberAlertPrefs(
  tx: StoreTx,
  storeId: string,
  userId: string,
  isOwner: boolean,
): Promise<MemberAlertPrefs> {
  const [row] = await tx
    .select({ prefs: storeMember.notificationPrefs })
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  return parseMemberAlertPrefs(row?.prefs ?? null, isOwner)
}

/** Saves the member's choices on their own staff row, keeping the day the summary last went. */
export async function saveMemberAlertPrefs(
  tx: StoreTx,
  storeId: string,
  userId: string,
  isOwner: boolean,
  input: MemberAlertPrefsInput,
): Promise<MemberAlertPrefs> {
  const before = await loadMemberAlertPrefs(tx, storeId, userId, isOwner)
  const next: MemberAlertPrefs = {
    ...input,
    dailySummary: {
      ...input.dailySummary,
      // A new hour may fall later today: let it send today even if the old hour already did.
      lastSentOn:
        input.dailySummary.hour === before.dailySummary.hour
          ? before.dailySummary.lastSentOn
          : null,
    },
  }
  await tx
    .update(storeMember)
    .set({ notificationPrefs: next, updatedAt: new Date() })
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  return next
}

export type AlertMember = {
  userId: string
  email: string
  /** E.164 with the plus, from Account → Profile; null when they have not added one. */
  phone: string | null
  prefs: MemberAlertPrefs
}

/**
 * Active members who turned `alert` on, with their email and mobile. A member whose role does
 * not hold `permission` is left out even if they asked: an order alert must not show order
 * details to someone who cannot open Orders.
 */
async function alertMembers(
  tx: StoreTx,
  storeId: string,
  alert: MemberAlert,
  permission: Permission,
): Promise<AlertMember[]> {
  const rows = await tx
    .select({
      userId: storeMember.userId,
      prefs: storeMember.notificationPrefs,
      email: authSchema.user.email,
      phone: authSchema.user.phone,
    })
    .from(storeMember)
    .innerJoin(authSchema.user, eq(authSchema.user.id, storeMember.userId))
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.status, 'active')))
  const out: AlertMember[] = []
  for (const row of rows) {
    const access = await memberAccess(tx, storeId, row.userId)
    if (!access) continue
    if (!access.isOwner && !access.permissions.includes(permission)) continue
    const prefs = parseMemberAlertPrefs(row.prefs, access.isOwner)
    if (alertOn(prefs, alert)) {
      out.push({ userId: row.userId, email: row.email, phone: row.phone, prefs })
    }
  }
  return out
}

/**
 * One alert to one member on the channels they switched on: email to their sign-in address,
 * WhatsApp to their mobile (only when the store has a WhatsApp channel). Logged like every
 * notification; nothing goes when the store switched the message off.
 */
async function deliverToMember(
  ctx: StoreContext,
  template: TemplateId,
  member: Pick<AlertMember, 'email' | 'phone'>,
  switches: AlertSwitches,
  data: TemplateData,
  opts: DeliverOptions,
): Promise<DeliveryResult[]> {
  if (!(await messageOn(ctx, template))) return []
  const results: DeliveryResult[] = []
  for (const channel of await channelsFor(ctx, opts)) {
    const to =
      channel.requires === 'email'
        ? switches.email
          ? member.email
          : null
        : switches.whatsapp && member.phone
          ? member.phone.replace(/^\+/, '')
          : null
    if (!to) continue
    const r = await channel.send({
      to: channel.requires === 'email' ? { email: to } : { phone: to },
      template,
      data,
    })
    await ctx.tx.insert(notification).values({
      storeId: ctx.storeId,
      channel: channel.id,
      template,
      to,
      status: r.ok ? 'sent' : 'failed',
      providerRef: r.ok ? r.providerRef : null,
      error: r.ok ? null : r.error,
    })
    results.push({ channel: channel.id, to, ok: r.ok, error: r.ok ? undefined : r.error })
  }
  return results
}

type AlertOptions = DeliverOptions & {
  /** The admin's own URL (`ADMIN_URL`), for the "Open the order" button. */
  adminUrl: string
}

/** Tells every member with new-order alerts on (and Orders access) about `orderId`. */
export async function notifyMembersOfNewOrder(
  ctx: StoreContext,
  orderId: string,
  opts: AlertOptions,
): Promise<DeliveryResult[]> {
  const members = await alertMembers(ctx.tx, ctx.storeId, 'newOrder', permissions.ORDERS_READ)
  if (members.length === 0) return []
  const built = await buildTemplateData(ctx, orderId)
  if (!built) return []
  const data: TemplateData = {
    ...built.data,
    // The shopper's thank-you link is not for staff; theirs opens the order in the admin.
    orderUrl: undefined,
    actionUrl: `${opts.adminUrl.replace(/\/+$/, '')}/orders/${encodeURIComponent(orderId)}`,
  }
  const results: DeliveryResult[] = []
  for (const m of members) {
    results.push(
      ...(await deliverToMember(ctx, 'staff_new_order', m, m.prefs.newOrder, data, opts)),
    )
  }
  return results
}

/** Where the summary's figures come from: the day so far after noon, else all of yesterday. */
function summaryPeriod(now: Date): { from: Date; to: Date; today: boolean } {
  const today = wallClock(now).getUTCHours() >= 12
  return today
    ? { from: startOfDay(now), to: now, today }
    : { from: startOfDay(now, undefined, -1), to: startOfDay(now), today }
}

/** Orders, sales and what waits to ship, for the summary email. */
async function summaryFigures(tx: StoreTx, from: Date, to: Date) {
  const [placed] = await tx
    .select({ n: count(), paise: sum(order.totalPaise) })
    .from(order)
    .where(
      and(
        gte(order.placedAt, from),
        lt(order.placedAt, to),
        notInArray(order.status, ['draft', 'cancelled']),
      ),
    )
  const [toShip] = await tx
    .select({ n: count() })
    .from(order)
    .where(
      and(
        eq(order.status, 'open'),
        notInArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES]),
        inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
      ),
    )
  return {
    orders: placed?.n ?? 0,
    salesPaise: Number(placed?.paise ?? 0),
    toShip: toShip?.n ?? 0,
  }
}

/**
 * Sends the daily summary to every member whose chosen hour is now (IST) and who has not had
 * today's. Each member is claimed first (their `lastSentOn` set in the same statement that
 * checks it), so two overlapping sweeps never send twice. Returns how many members it sent to.
 */
export async function sendDueDailySummaries(
  ctx: StoreContext,
  opts: AlertOptions & { now?: Date | undefined },
): Promise<number> {
  const now = opts.now ?? new Date()
  const hour = wallClock(now).getUTCHours()
  const today = dayKey(now)
  const due = (
    await alertMembers(ctx.tx, ctx.storeId, 'dailySummary', permissions.ORDERS_READ)
  ).filter((m) => m.prefs.dailySummary.hour === hour && m.prefs.dailySummary.lastSentOn !== today)
  if (due.length === 0) return 0

  const period = summaryPeriod(now)
  const figures = await summaryFigures(ctx.tx, period.from, period.to)
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const data: TemplateData = {
    storeName: s?.name ?? '',
    customerName: '',
    totalLabel: '',
    lines: [],
    paymentMethodLabel: '',
    actionUrl: `${opts.adminUrl.replace(/\/+$/, '')}/`,
    dailySummary: {
      periodLabel: period.today ? 'Today so far' : 'Yesterday',
      orders: figures.orders,
      salesLabel: formatMoney(figures.salesPaise),
      toShip: figures.toShip,
    },
  }

  let sent = 0
  for (const m of due) {
    const claimed = await ctx.tx
      .update(storeMember)
      .set({
        notificationPrefs: sql`jsonb_set(${storeMember.notificationPrefs}, '{dailySummary,lastSentOn}', to_jsonb(${today}::text))`,
      })
      .where(
        and(
          eq(storeMember.storeId, ctx.storeId),
          eq(storeMember.userId, m.userId),
          ne(
            sql`coalesce(${storeMember.notificationPrefs} -> 'dailySummary' ->> 'lastSentOn', '')`,
            today,
          ),
        ),
      )
      .returning({ id: storeMember.id })
    if (claimed.length === 0) continue
    await deliverToMember(ctx, 'staff_daily_summary', m, m.prefs.dailySummary, data, opts)
    sent += 1
  }
  return sent
}
