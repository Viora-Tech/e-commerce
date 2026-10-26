import { loadEnv } from '@commerce/config'
import {
  listPlatformAudit,
  listPlatformStores,
  listPlatformUsers,
  PLATFORM_AUDIT_SOURCES,
  PLATFORM_STORE_STATES,
  platformOverview,
  platformStoreDetail,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { platformProcedure, SEARCH_MAX } from '../procedures'
import { openBugReportCount } from '../services/platform.service'
import { platformReportsRouter } from './platform-reports'

/** Page numbers the console's lists accept; far beyond any real page count. */
const PAGE_MAX_NUMBER = 10_000

const page = z.number().int().min(1).max(PAGE_MAX_NUMBER).optional()
const search = z.string().trim().max(SEARCH_MAX).optional()

/** "q=asha page=2" for the access log: what was asked, never what came back. */
function describe(input: Record<string, unknown>): string | null {
  const parts = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : String(v)}`)
  return parts.length ? parts.join(' ') : null
}

/**
 * The platform console (`/platform`, Koomerce staff only). Every procedure goes through
 * `platformProcedure` (allowlist + passkey session + owner connection, NOT_FOUND otherwise),
 * reads only, and writes one access-log row per call. Excluded from MCP and access tokens
 * (`mcp/action-catalogue.ts`). Developer docs: Operations > Platform console.
 */
export const platformRouter = {
  /** Who is looking: the console's header and the guard check for its pages. */
  whoami: platformProcedure.handler(({ context }) => context.platform.actor),

  overview: platformProcedure.handler(async ({ context }) => {
    const env = loadEnv(process.env)
    const [numbers, queues, openReports] = await Promise.all([
      platformOverview(context.platform.db),
      context.queueHealth ? context.queueHealth().catch(() => null) : null,
      openBugReportCount({
        fetch: context.githubFetch ?? fetch,
        token: env.GITHUB_ISSUES_TOKEN,
        repo: env.GITHUB_ISSUES_REPO,
      }),
    ])
    await context.platform.audit('overview.read')
    return { ...numbers, queues, openReports }
  }),

  stores: {
    list: platformProcedure
      .input(z.object({ search, state: z.enum(PLATFORM_STORE_STATES).optional(), page }))
      .handler(async ({ context, input }) => {
        const result = await listPlatformStores(context.platform.db, input)
        await context.platform.audit('stores.list', { target: describe(input) })
        return result
      }),

    get: platformProcedure.input(z.object({ id: z.uuid() })).handler(async ({ context, input }) => {
      const detail = await platformStoreDetail(context.platform.db, input.id)
      if (!detail) throw new ORPCError('NOT_FOUND', { message: 'No store with that id' })
      await context.platform.audit('stores.detail', { storeId: input.id })
      return detail
    }),
  },

  users: {
    list: platformProcedure
      .input(z.object({ search, page }))
      .handler(async ({ context, input }) => {
        const result = await listPlatformUsers(context.platform.db, input)
        await context.platform.audit('users.list', { target: describe(input) })
        return result
      }),
  },

  audit: {
    list: platformProcedure
      .input(
        z.object({
          source: z.enum(PLATFORM_AUDIT_SOURCES).optional(),
          storeId: z.uuid().optional(),
          actor: search,
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          page,
        }),
      )
      .handler(async ({ context, input }) => {
        const result = await listPlatformAudit(context.platform.db, input)
        await context.platform.audit('audit.list', {
          storeId: input.storeId ?? null,
          target: describe({ ...input, storeId: undefined }),
        })
        return result
      }),
  },

  /** Bug reports (`/platform/reports`), owned by the bug-report work. */
  reports: platformReportsRouter,
}
