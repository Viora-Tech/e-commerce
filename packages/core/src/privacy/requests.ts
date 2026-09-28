/** SOURCE OF TRUTH: data requests — WHAT: create (from the storefront account page or logged by staff), list, read and move a customer's request for a copy of their data or for its erasure, each with a due date from Settings → Customer privacy and every step in the privacy audit trail / WHY: the DPDP Act gives shoppers these rights and the store has to answer in time and show how it did */
import { customer, dataRequest } from '@commerce/db'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type PrivacyActor, recordPrivacyEvent } from './audit'
import {
  type DataRequestKind,
  type DataRequestSource,
  type DataRequestStatus,
  isOpenStatus,
  nextStatuses,
  requestDueAt,
} from './client'
import { loadCustomerPrivacySettings } from './service'

export type DataRequestRow = typeof dataRequest.$inferSelect

export class DataRequestError extends Error {
  constructor(
    readonly reason: 'not_found' | 'closed' | 'bad_status' | 'already_open' | 'anonymised',
    message: string,
  ) {
    super(message)
    this.name = 'DataRequestError'
  }
}

async function nextRequestNumber(ctx: StoreContext): Promise<number> {
  await ctx.tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`data_request_number:${ctx.storeId}`}, 0))`,
  )
  const [row] = await ctx.tx
    .select({ max: sql<number>`coalesce(max(${dataRequest.number}), 0)::int` })
    .from(dataRequest)
    .where(eq(dataRequest.storeId, ctx.storeId))
  return (row?.max ?? 0) + 1
}

export type CreateDataRequestInput = {
  kind: DataRequestKind
  source: DataRequestSource
  customerId?: string | null | undefined
  contactEmail?: string | null | undefined
  contactPhone?: string | null | undefined
  note?: string | null | undefined
  actor: PrivacyActor
  at?: Date | undefined
}

/**
 * A customer id from the admin, checked under this store's RLS before it is written: a
 * foreign key does not see RLS, so another store's customer id would otherwise be stored
 * (and pinned for good by the append-only audit trail).
 */
async function assertLinkableCustomer(ctx: StoreContext, customerId: string): Promise<void> {
  const [cu] = await ctx.tx
    .select({ anonymisedAt: customer.anonymisedAt })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!cu) throw new DataRequestError('not_found', 'Customer not found')
  if (cu.anonymisedAt) {
    throw new DataRequestError('anonymised', "This customer's data was already erased")
  }
}

/**
 * The request an export or erasure answers: it must be this store's, and, when it names
 * a customer, that same customer. Otherwise erasing customer X could close Y's deletion
 * request and the audit trail would say Y was erased.
 */
export async function requestAnsweredFor(
  ctx: StoreContext,
  dataRequestId: string,
  customerId: string,
): Promise<DataRequestRow> {
  const [row] = await ctx.tx.select().from(dataRequest).where(eq(dataRequest.id, dataRequestId))
  if (!row) throw new DataRequestError('not_found', 'Request not found')
  if (!requestMatchesCustomer(row.customerId, customerId)) {
    throw new DataRequestError('bad_status', 'This request is for another customer')
  }
  return row
}

/** A request with no customer yet may be answered for anyone; otherwise only its own. */
export function requestMatchesCustomer(requestCustomerId: string | null, customerId: string) {
  return requestCustomerId === null || requestCustomerId === customerId
}

/**
 * Open a request. A customer who already has an open request of the same kind
 * gets that one back instead of a second (a double tap, or asking twice).
 */
export async function createDataRequest(
  ctx: StoreContext,
  input: CreateDataRequestInput,
): Promise<{ request: DataRequestRow; created: boolean }> {
  const at = input.at ?? new Date()
  if (input.customerId) {
    await assertLinkableCustomer(ctx, input.customerId)
    const [open] = await ctx.tx
      .select()
      .from(dataRequest)
      .where(
        and(
          eq(dataRequest.customerId, input.customerId),
          eq(dataRequest.kind, input.kind),
          inArray(dataRequest.status, ['open', 'in_progress']),
        ),
      )
    if (open) return { request: open, created: false }
  }
  const settings = await loadCustomerPrivacySettings(ctx)
  const number = await nextRequestNumber(ctx)
  const [row] = await ctx.tx
    .insert(dataRequest)
    .values({
      storeId: ctx.storeId,
      number,
      kind: input.kind,
      source: input.source,
      customerId: input.customerId ?? null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      note: input.note?.trim() || null,
      dueAt: requestDueAt(at, settings.requestDueDays),
      createdAt: at,
      updatedAt: at,
    })
    .returning()
  if (!row) throw new Error('data request insert returned nothing')
  await recordPrivacyEvent(ctx, {
    action: 'request.created',
    actor: input.actor,
    dataRequestId: row.id,
    customerId: row.customerId,
    detail: { kind: row.kind, source: row.source, number: row.number },
    at,
  })
  return { request: row, created: true }
}

export type DataRequestListItem = DataRequestRow & { customerName: string | null }

/** The queue: open work first by due date, then closed requests newest first. */
export async function listDataRequests(
  ctx: StoreContext,
  filter: { status?: 'open' | 'closed' | 'all' } = {},
): Promise<DataRequestListItem[]> {
  const status = filter.status ?? 'open'
  const where =
    status === 'open'
      ? inArray(dataRequest.status, ['open', 'in_progress'])
      : status === 'closed'
        ? inArray(dataRequest.status, ['completed', 'rejected'])
        : undefined
  const rows = await ctx.tx
    .select({ request: dataRequest, customerName: customer.name })
    .from(dataRequest)
    .leftJoin(customer, eq(customer.id, dataRequest.customerId))
    .where(and(eq(dataRequest.storeId, ctx.storeId), where))
    .orderBy(
      status === 'open' ? asc(dataRequest.dueAt) : desc(dataRequest.createdAt),
      desc(dataRequest.number),
    )
    .limit(500)
  return rows.map((r) => ({ ...r.request, customerName: r.customerName }))
}

export async function getDataRequest(ctx: StoreContext, id: string) {
  const [row] = await ctx.tx
    .select({
      request: dataRequest,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        anonymisedAt: customer.anonymisedAt,
      },
    })
    .from(dataRequest)
    .leftJoin(customer, eq(customer.id, dataRequest.customerId))
    .where(eq(dataRequest.id, id))
  if (!row) return null
  return { ...row.request, customer: row.customer?.id ? row.customer : null }
}

/** Open requests per status, and how many are past due, for the settings page badge. */
export async function dataRequestCounts(ctx: StoreContext, now = new Date()) {
  const [row] = await ctx.tx
    .select({
      open: sql<number>`count(*) filter (where ${dataRequest.status} in ('open', 'in_progress'))::int`,
      overdue: sql<number>`count(*) filter (where ${dataRequest.status} in ('open', 'in_progress') and ${dataRequest.dueAt} < ${now.toISOString()}::timestamptz)::int`,
    })
    .from(dataRequest)
    .where(eq(dataRequest.storeId, ctx.storeId))
  return row ?? { open: 0, overdue: 0 }
}

/**
 * Move a request along. Completing or declining closes it for good; declining
 * needs a reason the shopper can be told. Linking a customer (for requests
 * logged before the person was found) is allowed while it is open.
 */
export async function updateDataRequest(
  ctx: StoreContext,
  id: string,
  input: {
    status?: DataRequestStatus | undefined
    resolution?: string | null | undefined
    customerId?: string | null | undefined
  },
  actor: PrivacyActor,
  at = new Date(),
): Promise<DataRequestRow> {
  const current = await getDataRequest(ctx, id)
  if (!current) throw new DataRequestError('not_found', 'Request not found')
  if (!isOpenStatus(current.status)) {
    throw new DataRequestError('closed', 'This request is already closed')
  }
  const status = input.status ?? current.status
  if (status !== current.status && !nextStatuses(current.status).includes(status)) {
    throw new DataRequestError(
      'bad_status',
      `A request cannot go from ${current.status} to ${status}`,
    )
  }
  const resolution =
    input.resolution === undefined ? current.resolution : input.resolution?.trim() || null
  if (status === 'rejected' && !resolution) {
    throw new DataRequestError('bad_status', 'Say why the request is declined')
  }
  if (input.customerId) await assertLinkableCustomer(ctx, input.customerId)
  const closing = !isOpenStatus(status)
  const [row] = await ctx.tx
    .update(dataRequest)
    .set({
      status,
      resolution,
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      completedAt: closing ? at : null,
      updatedAt: at,
    })
    .where(eq(dataRequest.id, id))
    .returning()
  if (!row) throw new DataRequestError('not_found', 'Request not found')
  if (status !== current.status) {
    await recordPrivacyEvent(ctx, {
      action: 'request.status',
      actor,
      dataRequestId: id,
      customerId: row.customerId,
      detail: { from: current.status, to: status },
      at,
    })
  }
  if (input.customerId !== undefined && input.customerId !== current.customerId) {
    await recordPrivacyEvent(ctx, {
      action: 'request.note',
      actor,
      dataRequestId: id,
      customerId: row.customerId,
      detail: { linkedCustomer: input.customerId !== null },
      at,
    })
  }
  return row
}

/** A signed-in shopper's own requests, newest first, for their account page. */
export async function customerDataRequests(ctx: StoreContext, customerId: string) {
  return ctx.tx
    .select({
      id: dataRequest.id,
      number: dataRequest.number,
      kind: dataRequest.kind,
      status: dataRequest.status,
      dueAt: dataRequest.dueAt,
      createdAt: dataRequest.createdAt,
      completedAt: dataRequest.completedAt,
    })
    .from(dataRequest)
    .where(eq(dataRequest.customerId, customerId))
    .orderBy(desc(dataRequest.createdAt))
    .limit(20)
}
