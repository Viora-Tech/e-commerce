import { settingsSecret } from '@commerce/config'
import {
  createAddress,
  customerExists,
  deleteAddress,
  listAddresses,
  permissions,
  setMarketingConsent,
  updateAddress,
} from '@commerce/core'
import { lenientPhone } from '@commerce/core/phone'
import { loadPincodeDirectory } from '@commerce/shipping/pincode-directory'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can, heavy, PAGE_SIZE_MAX, SEARCH_MAX, storeProcedure } from '../procedures'
import {
  customerOverview,
  customerStats,
  customerTags,
  deleteCustomer,
  deleteSegment,
  getCustomer,
  getSegment,
  listAllCustomers,
  listCustomers,
  listSegmentCustomers,
  listSegments,
  saveSegment,
  tagCustomers,
  updateCustomer,
} from '../services/customer.service'
import { customerSheet } from '../services/customer-sheet.service'

const FiltersSchema = z.object({
  search: z.string().trim().max(SEARCH_MAX).optional(),
  segment: z.enum(['new', 'returning', 'subscribed']).optional(),
  stateCode: z.string().trim().length(2).optional(),
  minSpentPaise: z.number().int().min(0).optional(),
  maxSpentPaise: z.number().int().min(0).optional(),
  minOrders: z.number().int().min(0).optional(),
  acceptsMarketing: z.boolean().optional(),
  tag: z.string().trim().min(1).max(40).optional(),
})

const RulesSchema = z.object({
  match: z.enum(['all', 'any']).default('all'),
  conditions: z
    .array(
      z.object({
        field: z.enum(['spend', 'orders', 'state', 'tag', 'last_order_days', 'marketing']),
        op: z.enum(['gte', 'lte', 'eq', 'neq', 'contains']),
        value: z.string().trim().max(100),
      }),
    )
    .max(20)
    .default([]),
})

const AddressSchema = z.object({
  name: z.string().max(120),
  line1: z.string().max(200),
  line2: z.string().max(200).optional(),
  city: z.string().max(80),
  stateCode: z.string().max(2),
  pincode: z.string().max(10),
  phone: z.string().max(30),
  isDefault: z.boolean().optional(),
})

/**
 * The address book belongs to one customer of this store. RLS already hides
 * other stores' customers; checking the customer is visible stops an address
 * being written against another store's customer id.
 */
async function assertCustomer(tx: Parameters<typeof customerExists>[0], id: string) {
  if (!(await customerExists(tx, id))) {
    throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
  }
}

type AddressResult = Awaited<ReturnType<typeof createAddress>>

function unwrap(result: AddressResult) {
  if (result.ok) return { id: result.id }
  throw new ORPCError('BAD_REQUEST', {
    message: Object.values(result.errors)[0] ?? 'Check the address',
    data: { errors: result.errors },
  })
}

export const customersRouter = {
  list: can(permissions.CUSTOMERS_READ)
    .input(
      FiltersSchema.extend({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        sort: z.enum(['recent', 'name', 'orders', 'spent']).optional(),
      }),
    )
    .handler(({ context, input }) => listCustomers(context.tx, input, settingsSecret())),

  stats: can(permissions.CUSTOMERS_READ).handler(({ context }) => customerStats(context.tx)),

  /** Headline figures and the weekly series behind the Customer Overview card. */
  overview: can(permissions.CUSTOMERS_READ).handler(({ context }) =>
    customerOverview(context.tx, {
      storeId: context.scope.storeId,
      visitors: context.visitors,
    }),
  ),

  tags: can(permissions.CUSTOMERS_READ).handler(({ context }) => customerTags(context.tx)),

  /** Rows for a CSV export of the current filter; the browser builds the file. */
  export: can(permissions.CUSTOMERS_READ)
    .use(heavy('export'))
    .input(FiltersSchema)
    .handler(({ context, input }) => listAllCustomers(context.tx, input, settingsSecret())),

  get: can(permissions.CUSTOMERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const found = await getCustomer(context.tx, input.id, settingsSecret())
      if (!found) return null
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      return { ...found, addresses: await listAddresses(ctx, input.id) }
    }),

  /** Rows for the Customers bulk-edit spreadsheet, in the order the ids were given. */
  sheet: can(permissions.CUSTOMERS_READ)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(5000) }))
    .handler(({ context, input }) => customerSheet(context.tx, input.ids, settingsSecret())),

  /** Add an address to the customer's book; the first one becomes their default. */
  addAddress: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ customerId: z.uuid(), address: AddressSchema }))
    .handler(async ({ context, input }) => {
      await assertCustomer(context.tx, input.customerId)
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      return unwrap(await createAddress(ctx, input.customerId, input.address))
    }),

  updateAddress: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ customerId: z.uuid(), addressId: z.uuid(), address: AddressSchema }))
    .handler(async ({ context, input }) => {
      await assertCustomer(context.tx, input.customerId)
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      return unwrap(await updateAddress(ctx, input.customerId, input.addressId, input.address))
    }),

  deleteAddress: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ customerId: z.uuid(), addressId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertCustomer(context.tx, input.customerId)
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      const deleted = await deleteAddress(ctx, input.customerId, input.addressId)
      if (!deleted) throw new ORPCError('NOT_FOUND', { message: 'Address not found' })
      return { deleted }
    }),

  /**
   * City and state for a PIN code, from the same directory as Settings → Checkout's
   * "PIN code first". Null when unknown or the directory is not installed.
   */
  lookupPincode: storeProcedure
    .input(
      z.object({
        pincode: z
          .string()
          .trim()
          .regex(/^[1-9]\d{5}$/),
      }),
    )
    .handler(async ({ input }) => {
      try {
        const place = (await loadPincodeDirectory())?.lookup(input.pincode) ?? null
        return place ? { city: place.district, stateCode: place.stateCode } : null
      } catch {
        return null
      }
    }),

  update: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        name: z.string().trim().max(200).nullable().optional(),
        phone: lenientPhone(30).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
        note: z.string().trim().max(2000).nullable().optional(),
        acceptsMarketing: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input: { id, acceptsMarketing, ...patch } }) => {
      // Consent goes through the consent writer, so the change is in the customer's
      // history and the privacy audit trail with who made it.
      if (acceptsMarketing !== undefined) {
        await setMarketingConsent(
          { tx: context.tx, storeId: context.scope.storeId },
          {
            customerId: id,
            channel: 'email',
            granted: acceptsMarketing,
            source: 'admin',
            actor: {
              type: 'staff',
              id: context.scope.userId,
              label: context.session.user.name?.trim() || context.session.user.email,
            },
          },
        )
      }
      return updateCustomer(context.tx, id, patch, settingsSecret())
    }),

  delete: can(permissions.CUSTOMERS_DELETE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deleteCustomer(context.tx, input.id)),

  tagMany: can(permissions.CUSTOMERS_WRITE)
    .use(heavy('bulk'))
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1).max(BULK_MAX),
        tag: z.string().trim().min(1).max(40),
        action: z.enum(['add', 'remove']),
      }),
    )
    .handler(({ context, input }) => tagCustomers(context.tx, input)),

  segments: can(permissions.CUSTOMERS_READ).handler(({ context }) =>
    listSegments(context.tx, settingsSecret()),
  ),

  segment: can(permissions.CUSTOMERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getSegment(context.tx, input.id)),

  saveSegment: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        id: z.uuid().optional(),
        name: z.string().trim().min(1).max(80),
        rules: RulesSchema,
      }),
    )
    .handler(({ context, input }) =>
      saveSegment(context.tx, { ...input, storeId: context.scope.storeId }),
    ),

  deleteSegment: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deleteSegment(context.tx, input.id)),

  /** Live count and a sample for the rule builder. */
  previewSegment: can(permissions.CUSTOMERS_READ)
    .input(z.object({ rules: RulesSchema }))
    .handler(async ({ context, input }) => {
      const matches = await listSegmentCustomers(context.tx, input.rules, settingsSecret())
      return { total: matches.length, sample: matches.slice(0, 5) }
    }),
}
