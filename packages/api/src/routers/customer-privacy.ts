import { loadEnv } from '@commerce/config'
import {
  anonymiseCustomer,
  askConsentAgain,
  CONSENT_CHANNELS,
  cookieConsentSummary,
  createDataRequest,
  customerMarketingConsent,
  DATA_REQUEST_KINDS,
  DATA_REQUEST_STATUSES,
  DataRequestError,
  dataRequestCounts,
  EXPORT_FORMATS,
  exportCustomerData,
  getDataRequest,
  listDataRequests,
  listPrivacyEvents,
  loadCustomerPrivacySettings,
  loadPolicySettings,
  PRIVACY_LIMITS,
  type PrivacyActor,
  permissions,
  STAFF_REQUEST_SOURCES,
  saveCustomerPrivacySettings,
  setMarketingConsent,
  updateDataRequest,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

type Ctx = {
  tx: StoreTx
  scope: { storeId: string; userId: string }
  session: { user: { name?: string | null; email: string } }
}

const ctxOf = (context: Ctx) => ({ tx: context.tx, storeId: context.scope.storeId })

/** The signed-in staff member, as the audit trail names them. */
const staffOf = (context: Ctx): PrivacyActor => ({
  type: 'staff',
  id: context.scope.userId,
  label: context.session.user.name?.trim() || context.session.user.email,
})

/** Rule breaks become 400/404 with the message the admin shows. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof DataRequestError) {
      throw new ORPCError(error.reason === 'not_found' ? 'NOT_FOUND' : 'BAD_REQUEST', {
        message: error.message,
      })
    }
    throw error
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Settings → Customer privacy: the cookie banner, the data request queue
 * (export or erase), per-customer marketing consent and the audit trail.
 */
export const customerPrivacyRouter = {
  /** Everything the settings page shows at once. */
  overview: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const ctx = ctxOf(context)
    return {
      settings: await loadCustomerPrivacySettings(ctx),
      grievanceOfficer: (await loadPolicySettings(ctx)).grievanceOfficer,
      requests: await dataRequestCounts(ctx),
      consent30Days: await cookieConsentSummary(ctx, new Date(Date.now() - 30 * DAY_MS)),
    }
  }),

  saveSettings: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        bannerMessage: z.string().trim().max(PRIVACY_LIMITS.bannerMessage),
        requestDueDays: z
          .number()
          .int()
          .min(PRIVACY_LIMITS.minDueDays)
          .max(PRIVACY_LIMITS.maxDueDays),
      }),
    )
    .handler(({ context, input }) =>
      saveCustomerPrivacySettings(ctxOf(context), input, staffOf(context)),
    ),

  /** Show the banner to everyone again (after changing tags or the banner text). */
  askConsentAgain: can(permissions.SETTINGS_MANAGE).handler(({ context }) =>
    askConsentAgain(ctxOf(context), staffOf(context)),
  ),

  requests: can(permissions.CUSTOMERS_READ)
    .input(z.object({ status: z.enum(['open', 'closed', 'all']).default('open') }))
    .handler(({ context, input }) => listDataRequests(ctxOf(context), input)),

  request: can(permissions.CUSTOMERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const ctx = ctxOf(context)
      const request = await getDataRequest(ctx, input.id)
      if (!request) throw new ORPCError('NOT_FOUND', { message: 'Request not found' })
      const audit = await listPrivacyEvents(ctx, { dataRequestId: input.id })
      return { request, audit }
    }),

  /** Staff log a request that came by email, phone or in person. */
  createRequest: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        kind: z.enum(DATA_REQUEST_KINDS),
        source: z.enum(STAFF_REQUEST_SOURCES),
        customerId: z.uuid().nullable(),
        contactEmail: z.string().trim().max(254).nullable().optional(),
        contactPhone: z.string().trim().max(30).nullable().optional(),
        note: z.string().trim().max(PRIVACY_LIMITS.note).nullable().optional(),
      }),
    )
    .handler(({ context, input }) =>
      guard(() =>
        createDataRequest(ctxOf(context), { ...input, actor: staffOf(context) }).then(
          (r) => r.request,
        ),
      ),
    ),

  updateRequest: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        status: z.enum(DATA_REQUEST_STATUSES).optional(),
        resolution: z.string().trim().max(PRIVACY_LIMITS.resolution).nullable().optional(),
        customerId: z.uuid().nullable().optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) =>
      guard(() => updateDataRequest(ctxOf(context), id, patch, staffOf(context))),
    ),

  /** One-click export: the file to download, noted in the audit trail. */
  export: can(permissions.CUSTOMERS_READ)
    .input(
      z.object({
        customerId: z.uuid(),
        format: z.enum(EXPORT_FORMATS),
        dataRequestId: z.uuid().nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const file = await exportCustomerData(ctxOf(context), {
        ...input,
        secret: secret(),
        actor: staffOf(context),
      })
      if (!file) throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
      return file
    }),

  /**
   * Erase a customer's personal data, keeping what invoices need, and close
   * the request it answers. Needs the delete-customers permission.
   */
  anonymise: can(permissions.CUSTOMERS_DELETE)
    .input(z.object({ customerId: z.uuid(), dataRequestId: z.uuid().nullable().optional() }))
    .handler(({ context, input }) =>
      guard(async () => {
        const ctx = ctxOf(context)
        const actor = staffOf(context)
        const result = await anonymiseCustomer(ctx, { ...input, actor })
        if (input.dataRequestId) {
          const request = await getDataRequest(ctx, input.dataRequestId)
          if (request && (request.status === 'open' || request.status === 'in_progress')) {
            await updateDataRequest(ctx, input.dataRequestId, { status: 'completed' }, actor)
          }
        }
        return result
      }),
    ),

  audit: can(permissions.CUSTOMERS_READ)
    .input(z.object({ customerId: z.uuid().optional() }).default({}))
    .handler(({ context, input }) =>
      listPrivacyEvents(ctxOf(context), input.customerId ? { customerId: input.customerId } : {}),
    ),

  /** A customer's marketing consent per channel, with its history. */
  consent: can(permissions.CUSTOMERS_READ)
    .input(z.object({ customerId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const consent = await customerMarketingConsent(ctxOf(context), input.customerId)
      if (!consent) throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
      return consent
    }),

  /** Staff record consent the customer gave or withdrew outside the store (a call, a form). */
  setConsent: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        customerId: z.uuid(),
        channel: z.enum(CONSENT_CHANNELS),
        granted: z.boolean(),
      }),
    )
    .handler(async ({ context, input }) => {
      const changed = await setMarketingConsent(ctxOf(context), {
        ...input,
        source: 'admin',
        actor: staffOf(context),
      })
      return { changed }
    }),
}
