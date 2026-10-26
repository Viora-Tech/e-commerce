/** SOURCE OF TRUTH: platform console stores — WHAT: the cross-store store list (search, plan state, 30-day orders and GMV) and one store's detail (plan, domains, staff, apps, connected integrations, recent errors) / WHY: staff support stores without signing into them; integrations report connected yes/no only, never a key */
import type { Db } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'
import { platformRead } from './access'
import type { PlatformStoreState } from './client'
import { at, date, num, PLATFORM_PAGE_SIZE } from './sql'

const DAY_MS = 86_400_000
const ERROR_TEXT_MAX = 300

export type PlatformStoreRow = {
  id: string
  name: string
  slug: string
  domain: string | null
  ownerEmail: string | null
  plan: string | null
  planStatus: string | null
  createdAt: Date
  /** Latest sign-in of any member of the store. */
  lastActiveAt: Date | null
  orders30d: number
  gmv30dPaise: number
  appsInstalled: number
}

export type PlatformStoreList = {
  rows: PlatformStoreRow[]
  total: number
  page: number
  pageSize: number
}

export type PlatformStoreQuery = {
  search?: string | undefined
  state?: PlatformStoreState | undefined
  page?: number | undefined
}

/** `%term%` for ILIKE with the user's own `%`, `_` and `\` taken literally. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

function stateFilter(state: PlatformStoreState | undefined): SQL {
  if (!state) return sql`true`
  if (state === 'none') return sql`p.id is null`
  if (state === 'active') return sql`p.status in ('active', 'due')`
  return sql`p.status = ${state}`
}

function searchFilter(search: string | undefined): SQL {
  const term = search?.trim()
  if (!term) return sql`true`
  const pattern = likePattern(term)
  return sql`(
    s.name ilike ${pattern} or s.slug ilike ${pattern} or s.id::text = ${term}
    or exists (select 1 from store_domain sd where sd.store_id = s.id and sd.hostname ilike ${pattern})
    or exists (
      select 1 from member m join "user" u on u.id = m.user_id
      where m.organization_id = s.organization_id and u.email ilike ${pattern}
    )
  )`
}

type StoreListRow = {
  id: string
  name: string
  slug: string
  created_at: string | Date
  domain: string | null
  owner_email: string | null
  plan: string | null
  plan_status: string | null
  apps: string | number
  orders: string | number
  gmv: string | number
  last_active: string | Date | null
}

/** One page of every store on the platform, newest first. */
export async function listPlatformStores(
  owner: Db,
  query: PlatformStoreQuery = {},
  now = new Date(),
): Promise<PlatformStoreList> {
  const page = Math.max(1, Math.floor(query.page ?? 1))
  const since = new Date(now.getTime() - 30 * DAY_MS)
  const where = sql`${searchFilter(query.search)} and ${stateFilter(query.state)}`

  return platformRead(owner, async (tx) => {
    const [count] = await tx.execute<{ total: string }>(sql`
      select count(*) as total from store s left join store_plan p on p.store_id = s.id where ${where}
    `)
    const rows = await tx.execute<StoreListRow>(sql`
      select s.id, s.name, s.slug, s.created_at, d.hostname as domain, ow.email as owner_email,
        p.plan, p.status as plan_status,
        case when jsonb_typeof(s.apps -> 'installed') = 'array'
          then jsonb_array_length(s.apps -> 'installed') else 0 end as apps,
        o.orders, o.gmv, la.last_active
      from store s
      left join store_plan p on p.store_id = s.id
      left join lateral (
        select hostname from store_domain where store_id = s.id
        order by is_primary desc, created_at limit 1
      ) d on true
      left join lateral (
        select u.email from member m join "user" u on u.id = m.user_id
        where m.organization_id = s.organization_id and m.role = 'owner'
        order by m.created_at limit 1
      ) ow on true
      left join lateral (
        select count(*) as orders, coalesce(sum(total_paise), 0) as gmv from "order"
        where store_id = s.id and placed_at >= ${at(since)} and is_test = false
          and status in ('open', 'completed')
      ) o on true
      left join lateral (
        select max(si.created_at) as last_active from member m
        join member_sign_in si on si.user_id = m.user_id
        where m.organization_id = s.organization_id
      ) la on true
      where ${where}
      order by s.created_at desc, s.id
      limit ${PLATFORM_PAGE_SIZE} offset ${(page - 1) * PLATFORM_PAGE_SIZE}
    `)
    return {
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        domain: r.domain,
        ownerEmail: r.owner_email,
        plan: r.plan,
        planStatus: r.plan_status,
        createdAt: new Date(r.created_at),
        lastActiveAt: date(r.last_active),
        orders30d: num(r.orders),
        gmv30dPaise: num(r.gmv),
        appsInstalled: num(r.apps),
      })),
      total: num(count?.total),
      page,
      pageSize: PLATFORM_PAGE_SIZE,
    }
  })
}

/** One integration: a gateway, courier or channel, on or off and whether it has settings saved. */
export type PlatformIntegration = { id: string; enabled: boolean; configured: boolean }

export type PlatformStoreDetail = {
  store: {
    id: string
    name: string
    slug: string
    organizationId: string | null
    currency: string
    timezone: string
    createdAt: Date
  }
  plan: {
    plan: string
    interval: string
    status: string
    trialEndsAt: Date | null
    periodEnd: Date | null
    nextPlan: string | null
  } | null
  autopay: string | null
  bills: {
    number: number
    plan: string
    interval: string
    amountPaise: number
    status: string
    periodStart: Date
    paidAt: Date | null
  }[]
  domains: {
    hostname: string
    isPrimary: boolean
    kind: string
    status: string
    sslStatus: string
  }[]
  staff: {
    userId: string
    name: string | null
    email: string | null
    role: string
    status: string
    since: Date
  }[]
  apps: {
    id: string
    installedAt: Date | null
    lastErrorAt: Date | null
    lastError: string | null
  }[]
  integrations: {
    payments: PlatformIntegration[]
    shipping: PlatformIntegration[]
    notifications: PlatformIntegration[]
    channels: { provider: string; account: string | null }[]
  }
  orders: {
    last7d: number
    last30d: number
    gmv30dPaise: number
    test30d: number
    lastAt: Date | null
  }
  errors: { source: 'outbox' | 'notification'; what: string; error: string; at: Date }[]
}

type KeysRow = { enabled: unknown; keys: unknown }

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/**
 * Providers from one settings column: the enabled list and the ids that have saved settings.
 * Gateways keep their waiting Live/Test key set under `<id>~<mode>`, folded into `<id>`.
 */
function integrationsOf(row: KeysRow | undefined): PlatformIntegration[] {
  const enabled = strings(row?.enabled)
  const configured = new Set(strings(row?.keys).map((k) => k.split('~')[0] as string))
  const ids = [...new Set([...enabled, ...configured])].sort()
  return ids.map((id) => ({ id, enabled: enabled.includes(id), configured: configured.has(id) }))
}

/** Only the provider ids leave the database: the settings values (keys, secrets) never do. */
function settingsKeys(column: 'payments' | 'shipping' | 'notifications'): SQL {
  const col = sql.raw(column)
  return sql`
    select coalesce(s.${col} -> 'enabled', '[]'::jsonb) as enabled,
      coalesce((
        select jsonb_agg(k) from jsonb_object_keys(
          case when jsonb_typeof(s.${col} -> 'providers') = 'object'
            then s.${col} -> 'providers' else '{}'::jsonb end
        ) as k
      ), '[]'::jsonb) as keys
    from store s
  `
}

const clip = (v: string | null): string => (v ?? '').slice(0, ERROR_TEXT_MAX)

/** Everything the store detail page shows, or null when no store has that id. */
export async function platformStoreDetail(
  owner: Db,
  storeId: string,
  now = new Date(),
): Promise<PlatformStoreDetail | null> {
  const week = new Date(now.getTime() - 7 * DAY_MS)
  const month = new Date(now.getTime() - 30 * DAY_MS)

  return platformRead(owner, async (tx) => {
    const [s] = await tx.execute<{
      id: string
      name: string
      slug: string
      organization_id: string | null
      currency: string
      timezone: string
      created_at: string | Date
      installed: unknown
    }>(sql`
      select id, name, slug, organization_id, currency, timezone, created_at,
        apps -> 'installed' as installed
      from store where id = ${storeId}
    `)
    if (!s) return null

    const [plan] = await tx.execute<{
      plan: string
      interval: string
      status: string
      trial_ends_at: string | null
      period_end: string | null
      next_plan: string | null
    }>(sql`
      select plan, interval, status, trial_ends_at, period_end, next_plan
      from store_plan where store_id = ${storeId}
    `)
    const [autopay] = await tx.execute<{ status: string }>(sql`
      select status from autopay_mandate where store_id = ${storeId}
      order by created_at desc limit 1
    `)
    const bills = await tx.execute<{
      number: number
      plan: string
      interval: string
      amount: number
      status: string
      period_start: string
      paid_at: string | null
    }>(sql`
      select sales_order_number as number, plan, interval, amount_paise as amount, status,
        period_start, paid_at
      from plan_payment where store_id = ${storeId} order by created_at desc limit 6
    `)
    const domains = await tx.execute<{
      hostname: string
      is_primary: boolean
      kind: string
      status: string
      ssl_status: string
    }>(sql`
      select hostname, is_primary, kind, status, ssl_status from store_domain
      where store_id = ${storeId} order by is_primary desc, created_at
    `)
    const staff = await tx.execute<{
      user_id: string
      name: string | null
      email: string | null
      role: string
      status: string
      created_at: string
    }>(sql`
      select sm.user_id, u.name, u.email, r.name as role, sm.status, sm.created_at
      from store_member sm
      join role r on r.id = sm.role_id
      left join "user" u on u.id = sm.user_id
      where sm.store_id = ${storeId}
      order by sm.created_at
    `)
    const installs = await tx.execute<{
      plugin_id: string
      installed_at: string | null
      last_error_at: string | null
      last_error: string | null
    }>(sql`
      select plugin_id, installed_at, last_error_at, last_error from app_installation
      where store_id = ${storeId}
    `)
    const [payments] = await tx.execute<KeysRow>(
      sql`${settingsKeys('payments')} where s.id = ${storeId}`,
    )
    const [shipping] = await tx.execute<KeysRow>(
      sql`${settingsKeys('shipping')} where s.id = ${storeId}`,
    )
    const [notifications] = await tx.execute<KeysRow>(
      sql`${settingsKeys('notifications')} where s.id = ${storeId}`,
    )
    const channels = await tx.execute<{ provider: string; account_name: string | null }>(sql`
      select provider, account_name from channel_connection where store_id = ${storeId}
      order by provider
    `)
    const [orders] = await tx.execute<Record<string, unknown>>(sql`
      select
        count(*) filter (where not is_test and status in ('open', 'completed') and placed_at >= ${at(week)}) as d7,
        count(*) filter (where not is_test and status in ('open', 'completed')) as d30,
        coalesce(sum(total_paise) filter (where not is_test and status in ('open', 'completed')), 0) as gmv,
        count(*) filter (where is_test) as test,
        (select max(placed_at) from "order" where store_id = ${storeId} and not is_test) as last_at
      from "order" where store_id = ${storeId} and placed_at >= ${at(month)}
    `)
    const outboxErrors = await tx.execute<{ type: string; last_error: string; created_at: string }>(
      sql`
        select type, last_error, created_at from outbox_event
        where store_id = ${storeId} and last_error is not null
        order by created_at desc limit 10
      `,
    )
    const failedSends = await tx.execute<{
      channel: string
      template: string
      error: string | null
      created_at: string
    }>(sql`
      select channel, template, error, created_at from notification
      where store_id = ${storeId} and status = 'failed'
      order by created_at desc limit 10
    `)

    const installed = strings(s.installed)
    const installRows = new Map(installs.map((i) => [i.plugin_id, i]))
    const errors: PlatformStoreDetail['errors'] = [
      ...outboxErrors.map((e) => ({
        source: 'outbox' as const,
        what: e.type,
        error: clip(e.last_error),
        at: new Date(e.created_at),
      })),
      ...failedSends.map((n) => ({
        source: 'notification' as const,
        what: `${n.channel} · ${n.template}`,
        error: clip(n.error),
        at: new Date(n.created_at),
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 10)

    return {
      store: {
        id: s.id,
        name: s.name,
        slug: s.slug,
        organizationId: s.organization_id,
        currency: s.currency,
        timezone: s.timezone,
        createdAt: new Date(s.created_at),
      },
      plan: plan
        ? {
            plan: plan.plan,
            interval: plan.interval,
            status: plan.status,
            trialEndsAt: date(plan.trial_ends_at),
            periodEnd: date(plan.period_end),
            nextPlan: plan.next_plan,
          }
        : null,
      autopay: autopay?.status ?? null,
      bills: bills.map((b) => ({
        number: num(b.number),
        plan: b.plan,
        interval: b.interval,
        amountPaise: num(b.amount),
        status: b.status,
        periodStart: new Date(b.period_start),
        paidAt: date(b.paid_at),
      })),
      domains: domains.map((d) => ({
        hostname: d.hostname,
        isPrimary: d.is_primary,
        kind: d.kind,
        status: d.status,
        sslStatus: d.ssl_status,
      })),
      staff: staff.map((m) => ({
        userId: m.user_id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
        since: new Date(m.created_at),
      })),
      apps: installed.map((id) => {
        const row = installRows.get(id)
        return {
          id,
          installedAt: date(row?.installed_at),
          lastErrorAt: date(row?.last_error_at),
          lastError: row?.last_error ? clip(row.last_error) : null,
        }
      }),
      integrations: {
        payments: integrationsOf(payments),
        shipping: integrationsOf(shipping),
        notifications: integrationsOf(notifications),
        channels: channels.map((c) => ({ provider: c.provider, account: c.account_name })),
      },
      orders: {
        last7d: num(orders?.d7),
        last30d: num(orders?.d30),
        gmv30dPaise: num(orders?.gmv),
        test30d: num(orders?.test),
        lastAt: date(orders?.last_at),
      },
      errors,
    }
  })
}
