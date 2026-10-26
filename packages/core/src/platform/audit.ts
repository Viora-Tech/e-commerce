/** SOURCE OF TRUTH: platform console audit log — WHAT: the console's own access log and, read-only, the store-level platform events (exports, deletions), filtered by store, actor and date / WHY: every cross-store read by staff must be answerable later: who looked at which store, when */
import type { Db } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'
import { platformRead } from './access'
import type { PlatformAuditSource } from './client'
import { at, num, PLATFORM_PAGE_SIZE } from './sql'
import { likePattern } from './stores'

export type PlatformAuditQuery = {
  source?: PlatformAuditSource | undefined
  storeId?: string | undefined
  /** Part of the actor's email. */
  actor?: string | undefined
  from?: Date | undefined
  to?: Date | undefined
  page?: number | undefined
}

export type PlatformAuditRow = {
  id: string
  at: Date
  actorEmail: string | null
  action: string
  storeId: string | null
  storeName: string | null
  /** The console's target, or the store event's detail (counts and ids only) as text. */
  detail: string | null
}

export type PlatformAuditList = {
  rows: PlatformAuditRow[]
  total: number
  page: number
  pageSize: number
}

type AuditRow = {
  id: string
  created_at: string | Date
  actor_email: string | null
  action: string
  store_id: string | null
  store_name: string | null
  detail: string | null
}

function filters(q: PlatformAuditQuery, cols: { store: SQL; actor: SQL; time: SQL }): SQL {
  const parts: SQL[] = [sql`true`]
  if (q.storeId) parts.push(sql`${cols.store} = ${q.storeId}::uuid`)
  if (q.actor?.trim()) parts.push(sql`${cols.actor} ilike ${likePattern(q.actor.trim())}`)
  if (q.from) parts.push(sql`${cols.time} >= ${at(q.from)}`)
  if (q.to) parts.push(sql`${cols.time} < ${at(q.to)}`)
  return sql.join(parts, sql` and `)
}

/** One page of the chosen audit trail, newest first. */
export async function listPlatformAudit(
  owner: Db,
  query: PlatformAuditQuery = {},
): Promise<PlatformAuditList> {
  const page = Math.max(1, Math.floor(query.page ?? 1))
  const offset = (page - 1) * PLATFORM_PAGE_SIZE

  return platformRead(owner, async (tx) => {
    let total = 0
    let rows: AuditRow[] = []
    if ((query.source ?? 'console') === 'console') {
      const where = filters(query, {
        store: sql`l.store_id_ref`,
        actor: sql`l.actor_email`,
        time: sql`l.created_at`,
      })
      const [count] = await tx.execute<{ total: string }>(
        sql`select count(*) as total from platform_access_log l where ${where}`,
      )
      total = num(count?.total)
      rows = await tx.execute<AuditRow>(sql`
        select l.id, l.created_at, l.actor_email, l.action, l.store_id_ref as store_id,
          s.name as store_name, l.target as detail
        from platform_access_log l left join store s on s.id = l.store_id_ref
        where ${where}
        order by l.created_at desc, l.id limit ${PLATFORM_PAGE_SIZE} offset ${offset}
      `)
    } else {
      const where = filters(query, {
        store: sql`e.subject_store_id`,
        actor: sql`e.actor_email`,
        time: sql`e.created_at`,
      })
      const [count] = await tx.execute<{ total: string }>(
        sql`select count(*) as total from platform_audit_event e where ${where}`,
      )
      total = num(count?.total)
      rows = await tx.execute<AuditRow>(sql`
        select e.id, e.created_at, e.actor_email, e.action, e.subject_store_id as store_id,
          coalesce(s.name, e.subject_store_name) as store_name, e.detail::text as detail
        from platform_audit_event e left join store s on s.id = e.subject_store_id
        where ${where}
        order by e.created_at desc, e.id limit ${PLATFORM_PAGE_SIZE} offset ${offset}
      `)
    }
    return {
      rows: rows.map((r) => ({
        id: r.id,
        at: new Date(r.created_at),
        actorEmail: r.actor_email,
        action: r.action,
        storeId: r.store_id,
        storeName: r.store_name,
        detail: r.detail,
      })),
      total,
      page,
      pageSize: PLATFORM_PAGE_SIZE,
    }
  })
}
