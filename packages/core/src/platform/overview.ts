/** SOURCE OF TRUTH: platform console overview — WHAT: the cross-store numbers on /platform (stores by plan state, new stores, orders and GMV, subscriptions and MRR, failed payments, outbox health) / WHY: the people who run Koomerce need one honest read of the whole platform, test orders excluded */
import type { Db } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { PLAN_IDS, PLANS, type PlanId } from '../billing/plans'
import { platformRead } from './access'
import { at, date, num } from './sql'

const DAY_MS = 86_400_000
/** India Standard Time, the platform's reporting day. */
const IST_OFFSET_MS = 330 * 60_000

/** Midnight IST of the day `now` falls in, as an instant. */
export function startOfIstDay(now: Date): Date {
  const shifted = now.getTime() + IST_OFFSET_MS
  return new Date(shifted - (shifted % DAY_MS) - IST_OFFSET_MS)
}

export type PlatformSalesWindow = { orders: number; gmvPaise: number }

export type PlatformPlanCount = {
  plan: PlanId
  /** Paying stores (active, or a renewal due) on this plan. */
  stores: number
  /** Monthly recurring revenue from them, yearly plans spread over twelve months, before GST. */
  mrrPaise: number
}

export type PlatformOverview = {
  stores: {
    total: number
    /** Paid and current, or a renewal due inside the grace period. */
    active: number
    trialing: number
    paused: number
    cancelled: number
    /** No plan row yet (a store that never opened Plan & billing, or older than billing). */
    noPlan: number
    newThisWeek: number
  }
  sales: { today: PlatformSalesWindow; days7: PlatformSalesWindow; days30: PlatformSalesWindow }
  subscriptions: { plans: PlatformPlanCount[]; mrrPaise: number }
  payments: {
    /** Plan bills still waiting for payment. */
    billsDue: number
    /** Bills whose period has already started unpaid: the renewal failed or was ignored. */
    billsOverdue: number
    /** UPI AutoPay mandates Razorpay gave up retrying. */
    autopayHalted: number
  }
  outbox: {
    pending: number
    /** Pending events that already failed at least once. */
    failing: number
    oldestPendingAt: Date | null
  }
}

type CountRow = Record<string, string | number | Date | null>

/** Monthly value of one plan at one interval, before GST. */
export function monthlyPaise(plan: PlanId, interval: string): number {
  const prices = PLANS[plan].pricePaise
  return interval === 'year' ? Math.round(prices.year / 12) : prices.month
}

/** Everything on the platform console's Overview, in one read-only owner transaction. */
export async function platformOverview(owner: Db, now = new Date()): Promise<PlatformOverview> {
  const today = startOfIstDay(now)
  const week = new Date(now.getTime() - 7 * DAY_MS)
  const month = new Date(now.getTime() - 30 * DAY_MS)

  return platformRead(owner, async (tx) => {
    const [stores] = await tx.execute<CountRow>(sql`
      select count(*) as total,
        count(*) filter (where p.status in ('active', 'due')) as active,
        count(*) filter (where p.status = 'trialing') as trialing,
        count(*) filter (where p.status = 'paused') as paused,
        count(*) filter (where p.status = 'cancelled') as cancelled,
        count(*) filter (where p.id is null) as no_plan,
        count(*) filter (where s.created_at >= ${at(week)}) as new_week
      from store s left join store_plan p on p.store_id = s.id
    `)
    const [sales] = await tx.execute<CountRow>(sql`
      select
        count(*) filter (where o.placed_at >= ${at(today)}) as orders_today,
        coalesce(sum(o.total_paise) filter (where o.placed_at >= ${at(today)}), 0) as gmv_today,
        count(*) filter (where o.placed_at >= ${at(week)}) as orders_7,
        coalesce(sum(o.total_paise) filter (where o.placed_at >= ${at(week)}), 0) as gmv_7,
        count(*) as orders_30,
        coalesce(sum(o.total_paise), 0) as gmv_30
      from "order" o
      where o.placed_at >= ${at(month)} and o.is_test = false and o.status in ('open', 'completed')
    `)
    const planRows = await tx.execute<{ plan: string; interval: string; stores: string }>(sql`
      select plan, interval, count(*) as stores from store_plan
      where status in ('active', 'due') group by plan, interval
    `)
    const [bills] = await tx.execute<CountRow>(sql`
      select
        (select count(*) from plan_payment where status = 'due') as due,
        (select count(*) from plan_payment where status = 'due' and period_start < ${at(now)}) as overdue,
        (select count(*) from autopay_mandate where status = 'halted') as halted
    `)
    const [outbox] = await tx.execute<CountRow>(sql`
      select count(*) as pending,
        count(*) filter (where attempts > 0 or last_error is not null) as failing,
        min(created_at) as oldest
      from outbox_event where dispatched_at is null
    `)

    const plans: PlatformPlanCount[] = PLAN_IDS.map((plan) => {
      const rows = planRows.filter((r) => r.plan === plan)
      return {
        plan,
        stores: rows.reduce((n, r) => n + num(r.stores), 0),
        mrrPaise: rows.reduce((n, r) => n + num(r.stores) * monthlyPaise(plan, r.interval), 0),
      }
    })

    return {
      stores: {
        total: num(stores?.total),
        active: num(stores?.active),
        trialing: num(stores?.trialing),
        paused: num(stores?.paused),
        cancelled: num(stores?.cancelled),
        noPlan: num(stores?.no_plan),
        newThisWeek: num(stores?.new_week),
      },
      sales: {
        today: { orders: num(sales?.orders_today), gmvPaise: num(sales?.gmv_today) },
        days7: { orders: num(sales?.orders_7), gmvPaise: num(sales?.gmv_7) },
        days30: { orders: num(sales?.orders_30), gmvPaise: num(sales?.gmv_30) },
      },
      subscriptions: { plans, mrrPaise: plans.reduce((n, p) => n + p.mrrPaise, 0) },
      payments: {
        billsDue: num(bills?.due),
        billsOverdue: num(bills?.overdue),
        autopayHalted: num(bills?.halted),
      },
      outbox: {
        pending: num(outbox?.pending),
        failing: num(outbox?.failing),
        oldestPendingAt: date(outbox?.oldest),
      },
    }
  })
}
