/** SOURCE OF TRUTH: platform console users — WHAT: every admin user on the platform with their stores and roles, sign-up and last sign-in, and whether they have a passkey / WHY: staff answer "who is this person and which stores can they reach" without opening each store */
import type { Db } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'
import { platformRead } from './access'
import { date, num, PLATFORM_PAGE_SIZE } from './sql'
import { likePattern } from './stores'

export type PlatformUserRow = {
  id: string
  name: string
  email: string
  createdAt: Date
  lastSignInAt: Date | null
  /** How they last signed in (`email_otp`, `passkey`, `google`, `other`). */
  lastSignInMethod: string | null
  /** At least one passkey registered: the account's second factor. */
  passkey: boolean
  stores: { storeId: string; name: string; role: string; status: string }[]
}

export type PlatformUserList = {
  rows: PlatformUserRow[]
  total: number
  page: number
  pageSize: number
}

type UserRow = {
  id: string
  name: string
  email: string
  created_at: string | Date
  last_sign_in: string | Date | null
  last_method: string | null
  passkeys: string | number
  stores: unknown
}

type StoreEntry = { storeId: string; name: string; role: string; status: string }

function searchFilter(search: string | undefined): SQL {
  const term = search?.trim()
  if (!term) return sql`true`
  const pattern = likePattern(term)
  return sql`(u.name ilike ${pattern} or u.email ilike ${pattern} or u.id = ${term})`
}

/** One page of every admin user, newest first, filtered by name or email. */
export async function listPlatformUsers(
  owner: Db,
  query: { search?: string | undefined; page?: number | undefined } = {},
): Promise<PlatformUserList> {
  const page = Math.max(1, Math.floor(query.page ?? 1))
  const where = searchFilter(query.search)

  return platformRead(owner, async (tx) => {
    const [count] = await tx.execute<{ total: string }>(
      sql`select count(*) as total from "user" u where ${where}`,
    )
    const rows = await tx.execute<UserRow>(sql`
      select u.id, u.name, u.email, u.created_at, si.created_at as last_sign_in,
        si.method as last_method,
        (select count(*) from passkey pk where pk.user_id = u.id) as passkeys,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'storeId', s.id, 'name', s.name, 'role', r.name, 'status', sm.status
          ) order by s.name)
          from store_member sm
          join store s on s.id = sm.store_id
          join role r on r.id = sm.role_id
          where sm.user_id = u.id
        ), '[]'::jsonb) as stores
      from "user" u
      left join lateral (
        select created_at, method from member_sign_in where user_id = u.id
        order by created_at desc limit 1
      ) si on true
      where ${where}
      order by u.created_at desc, u.id
      limit ${PLATFORM_PAGE_SIZE} offset ${(page - 1) * PLATFORM_PAGE_SIZE}
    `)
    return {
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: new Date(r.created_at),
        lastSignInAt: date(r.last_sign_in),
        lastSignInMethod: r.last_method,
        passkey: num(r.passkeys) > 0,
        stores: Array.isArray(r.stores) ? (r.stores as StoreEntry[]) : [],
      })),
      total: num(count?.total),
      page,
      pageSize: PLATFORM_PAGE_SIZE,
    }
  })
}
