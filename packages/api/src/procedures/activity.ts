/**
 * SOURCE OF TRUTH KEYWORDS: store activity log, audit trail, store_activity, recordChange
 * WHAT:  After a store procedure that changes something succeeds, one `store_activity` row: who
 *        (member id, name, email), from where (admin, assistant, MCP, API; IP and browser), which
 *        procedure, the record it touched and what changed (the input, or the before/after a
 *        handler reports through `context.activity.note`), scrubbed by `scrubAudit`.
 * WHY:   "Who created the shipping zone Kinja?" had no answer: request logs are sampled and never
 *        leave the container. Reads are never recorded (the action catalogue's classification).
 * WHERE: `store.ts` calls `recordChange` inside the store transaction (a savepoint, so a failed
 *        insert never fails the change) and `detachedWith` in its own short transaction.
 *        Settings → Activity log reads it (`routers/activity-log.ts`).
 */
import type { StoreActivitySource, StoreTx } from '@commerce/db'
import { scrubAudit } from '@commerce/observability'
import type { AnyProcedure } from '@orpc/server'
import { areaOf, humanName, isReadPath, routerProcedures } from '../mcp/action-catalogue'
import { recordActivityRow } from '../services/store-activity.service'
import type { SessionContext } from './base'

/**
 * Procedures named like a change that change nothing in the store: previews, AI drafts, test
 * connections, read receipts, browser hand-offs. A name starting with `test` is one too.
 */
const NOT_A_CHANGE = new Set([
  'store.verifyShipping',
  'store.verifyStorage',
  'themes.thumbnail',
  'themes.proposeSection',
  'products.generateHandle',
  'billing.usageBillCsv',
  'blog.authors',
  'orders.refundOptions',
  'orders.editPreview',
  'orders.whatsappChat',
  'customers.whatsappChat',
  'inbox.markSeen',
  'inbox.aiAvailable',
  'inbox.suggestReplies',
  'inbox.summarise',
  'inbox.typing',
  'inbox.streamAccess',
  'marketing.campaignPerformance',
  'marketing.recommendations',
  'shortLinks.trend',
  'affiliates.trend',
  'affiliates.ledgerCsv',
  'affiliates.payouts.candidates',
  'affiliates.payouts.tdsReport',
  'codRto.orders',
  'codRto.returnReasons',
  'deliveryOptions.option',
  'deliveryOptions.tryPin',
  'platformApps.whatsapp',
  'analytics.refineQuery',
  'ai.writeProduct',
  'ai.suggestKeywords',
  'ai.assistant',
  'approvals.waiting',
  'approvals.mine',
  'media.presign',
  'media.usedIn',
  'gstInvoices.bulkPrint',
  'reviews.writeReply',
  'searchConsole.connectStart',
  'payments.razorpayOAuthStart',
  'bugReports.unreadCount',
  'bugReports.markSeen',
])

const nameOf = (path: string) => path.split('.').at(-1) ?? ''

/** True when a successful call to `path` is a change the activity log keeps. */
function isRecordedChange(path: string): boolean {
  if (!path || isReadPath(path) || NOT_A_CHANGE.has(path)) return false
  return !/^test([A-Z]|$)/.test(nameOf(path))
}

/**
 * A server-side `call()` (admin pages, tests) carries no path: the procedure is looked up in the
 * router instead. Built once, on first use (a static import of the router would be a cycle).
 */
let pathsByProcedure: Promise<Map<AnyProcedure, string>> | null = null

async function pathOf(path: readonly string[], procedure: AnyProcedure): Promise<string> {
  if (path.length) return path.join('.')
  pathsByProcedure ??= import('../routers/_app').then(
    ({ appRouter }) => new Map(routerProcedures(appRouter).map((p) => [p.procedure, p.path])),
  )
  return (await pathsByProcedure).get(procedure) ?? ''
}

/** The dotted path when a successful call to this procedure is a change the log keeps, else null. */
export async function recordedPath(
  path: readonly string[],
  procedure: AnyProcedure,
): Promise<string | null> {
  const dotted = await pathOf(path, procedure)
  return isRecordedChange(dotted) ? dotted : null
}

/** What a handler may add to its row: the record's fields before and after the change. */
export type ActivityNote = {
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  resourceId?: string | null
  /** The record's name for the summary ("Kinja"), when the input and answer do not carry one. */
  label?: string | null
}

/** `context.activity` in a store handler. */
export type ActivityRecorder = {
  note: (note: ActivityNote) => void
  /** Leave this call out of the log (a handler that turned out to change nothing). */
  skip: () => void
}

export function activityRecorder(): ActivityRecorder & { read: () => ActivityNote | null } {
  let current: ActivityNote | null = {}
  return {
    note: (note) => {
      if (current) current = { ...current, ...note }
    },
    skip: () => {
      current = null
    },
    read: () => current,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const LABEL_KEYS = ['name', 'title', 'code', 'handle', 'label', 'number', 'orderNumber']

function labelIn(value: unknown): string | null {
  if (!isRecord(value)) return null
  for (const key of LABEL_KEYS) {
    const v = value[key]
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v).trim()
  }
  return null
}

function idIn(value: unknown): string | null {
  if (!isRecord(value)) return null
  if (typeof value.id === 'string') return value.id
  for (const [key, v] of Object.entries(value)) {
    if (/Id$/.test(key) && typeof v === 'string') return v
  }
  return null
}

/** The fields whose values differ, each side scrubbed. */
function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue
    b[key] = before[key] ?? null
    a[key] = after[key] ?? null
  }
  return {
    before: scrubAudit(b) as Record<string, unknown>,
    after: scrubAudit(a) as Record<string, unknown>,
  }
}

function changesOf(input: unknown, note: ActivityNote) {
  if (note.before || note.after) return diff(note.before ?? {}, note.after ?? {})
  return input === undefined ? null : { input: scrubAudit(input) }
}

function sourceOf(context: SessionContext, path: string): StoreActivitySource {
  const token = context.apiPrincipal
  if (token) return token.kind === 'oauth' ? 'mcp' : 'api'
  if (path === 'ai.approveAction' || path === 'ai.undoAction') return 'assistant'
  return 'admin'
}

function clientIp(headers: Headers | undefined): string | null {
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return headers?.get('cf-connecting-ip') ?? forwarded ?? headers?.get('x-real-ip') ?? null
}

/** The row for one successful change. */
function entryFor(
  context: SessionContext,
  path: string,
  input: unknown,
  output: unknown,
  note: ActivityNote,
) {
  const token = context.apiPrincipal
  const label =
    note.label ??
    labelIn(input) ??
    (isRecord(input) ? labelIn(input.data) : null) ??
    labelIn(output)
  const shownLabel = label ? String(scrubAudit(label)).slice(0, 120) : null
  const via = token ? ` · via ${token.name}` : context.approvalReplay ? ' · approved' : ''
  return {
    actorUserId: context.session.user.id,
    actorName: context.session.user.name || null,
    actorEmail: context.session.user.email || null,
    source: sourceOf(context, path),
    action: path,
    area: areaOf(path) ?? path.split('.')[0] ?? 'other',
    resourceType: path.split('.').slice(0, -1).join('.') || null,
    resourceId: note.resourceId ?? idIn(input) ?? idIn(output),
    summary: `${humanName(path)}${shownLabel ? ` · ${shownLabel}` : ''}${via}`,
    changes: changesOf(input, note),
    ip: clientIp(context.headers),
    userAgent: context.headers?.get('user-agent') ?? null,
  }
}

/**
 * Records a successful change, in a savepoint of the store transaction: if the insert fails the
 * change still commits, and the failure is reported. A read, or a call a handler skipped, writes
 * nothing.
 */
export async function recordChange(
  context: SessionContext,
  tx: StoreTx,
  storeId: string,
  call: {
    path: readonly string[]
    procedure: AnyProcedure
    input: unknown
    output: unknown
    note: ActivityNote | null
  },
): Promise<void> {
  try {
    if (!call.note) return
    const path = await recordedPath(call.path, call.procedure)
    if (!path) return
    const entry = entryFor(context, path, call.input, call.output, call.note)
    await recordActivityRow(tx, storeId, entry)
  } catch (error) {
    context.reportError?.(error, { storeId })
  }
}
