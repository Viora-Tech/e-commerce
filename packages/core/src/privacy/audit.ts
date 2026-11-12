/** SOURCE OF TRUTH: privacy audit trail — WHAT: append-only record of who did what to whose personal data (requests made and moved, exports downloaded, customers erased, consent changed by staff, privacy settings saved) and how it is read back / WHY: the DPDP Act expects a business to show how it handled each data request; one writer keeps entries uniform and free of personal data */
import { privacyAuditEvent } from '@commerce/db'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import type { StoreContext } from '../context'

/** Who acted. Staff carry their user id and a label (name or email) kept as it was then. */
export type PrivacyActor = {
  type: 'customer' | 'staff' | 'system'
  id?: string | null | undefined
  label?: string | null | undefined
}

const PRIVACY_AUDIT_ACTIONS = [
  'request.created',
  'request.status',
  'request.note',
  'export.downloaded',
  'customer.anonymised',
  'consent.changed',
  'settings.saved',
  'account.deletion_requested',
  'contact.phone_added',
  /** Two customer records became one (`mergeCustomers`); written on both. */
  'customer.merged',
] as const
export type PrivacyAuditAction = (typeof PRIVACY_AUDIT_ACTIONS)[number]

export type PrivacyAuditInput = {
  action: PrivacyAuditAction
  actor: PrivacyActor
  dataRequestId?: string | null | undefined
  customerId?: string | null | undefined
  /** Facts about the change (ids, counts, field names, from/to statuses). Never names, emails or phones. */
  detail?: Record<string, unknown> | undefined
  at?: Date | undefined
}

export async function recordPrivacyEvent(ctx: StoreContext, input: PrivacyAuditInput) {
  await ctx.tx.insert(privacyAuditEvent).values({
    storeId: ctx.storeId,
    dataRequestId: input.dataRequestId ?? null,
    customerId: input.customerId ?? null,
    actorType: input.actor.type,
    actorId: input.actor.id ?? null,
    actorLabel: input.actor.label ?? null,
    action: input.action,
    detail: input.detail ?? null,
    ...(input.at ? { createdAt: input.at } : {}),
  })
}

export type PrivacyAuditEntry = {
  id: string
  action: string
  actorType: 'customer' | 'staff' | 'system'
  actorLabel: string | null
  dataRequestId: string | null
  customerId: string | null
  detail: Record<string, unknown> | null
  createdAt: Date
}

/** Newest first. Filter by request or customer; without either, the whole store's trail. */
export async function listPrivacyEvents(
  ctx: StoreContext,
  filter: { dataRequestId?: string; customerId?: string; limit?: number } = {},
): Promise<PrivacyAuditEntry[]> {
  const where: SQL[] = [eq(privacyAuditEvent.storeId, ctx.storeId)]
  if (filter.dataRequestId) where.push(eq(privacyAuditEvent.dataRequestId, filter.dataRequestId))
  if (filter.customerId) where.push(eq(privacyAuditEvent.customerId, filter.customerId))
  return ctx.tx
    .select({
      id: privacyAuditEvent.id,
      action: privacyAuditEvent.action,
      actorType: privacyAuditEvent.actorType,
      actorLabel: privacyAuditEvent.actorLabel,
      dataRequestId: privacyAuditEvent.dataRequestId,
      customerId: privacyAuditEvent.customerId,
      detail: privacyAuditEvent.detail,
      createdAt: privacyAuditEvent.createdAt,
    })
    .from(privacyAuditEvent)
    .where(and(...where))
    .orderBy(desc(privacyAuditEvent.createdAt), desc(privacyAuditEvent.id))
    .limit(Math.min(filter.limit ?? 200, 500))
}
