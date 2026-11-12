import { loadEnv, settingsSecret } from '@commerce/config'
import {
  adoptContactPhone,
  createAddress,
  createCustomer,
  customerExists,
  customerWithEmail,
  deleteAddress,
  GSTIN_MESSAGES,
  listAddresses,
  mergeCustomers,
  noteWhatsappChat,
  permissions,
  previewCustomerMerge,
  recordCustomerChange,
  SEGMENT_FIELDS,
  SEGMENT_OPS,
  StoreCreditError,
  setDefaultAddress,
  setDefaultBillingAddress,
  setMarketingConsent,
  suggestContactPhone,
  updateAddress,
  validateGstin,
  WHATSAPP_CHAT_TEMPLATES,
  whatsappChatContext,
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
  getCustomer,
  listAllCustomers,
  listCustomers,
  tagCustomers,
  updateCustomer,
} from '../services/customer.service'
import { emailCustomer } from '../services/customer-email.service'
import {
  deleteSegment,
  getSegment,
  listSegmentCustomers,
  listSegments,
  saveSegment,
} from '../services/customer-segment.service'
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
  /** Business (B2B) customers, i.e. those with a saved GSTIN. */
  business: z.boolean().optional(),
  /** Any of these (the admin's multi-pick filters); the single fields above still work. */
  stateCodes: z.array(z.string().trim().length(2)).max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
  maxOrders: z.number().int().min(0).optional(),
  acceptsSms: z.boolean().optional(),
  acceptsWhatsapp: z.boolean().optional(),
  /** Created, or last ordered, in [from, to). */
  createdFrom: z.iso.datetime().optional(),
  createdTo: z.iso.datetime().optional(),
  lastOrderFrom: z.iso.datetime().optional(),
  lastOrderTo: z.iso.datetime().optional(),
})

const RulesSchema = z.object({
  match: z.enum(['all', 'any']).default('all'),
  conditions: z
    .array(
      z.object({
        field: z.enum(SEGMENT_FIELDS),
        op: z.enum(SEGMENT_OPS),
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
  /** The default shipping address. */
  isDefault: z.boolean().optional(),
  /** The default billing address; left out keeps it as it is. */
  isDefaultBilling: z.boolean().optional(),
  /** Company billed at this address; blank clears it, left out keeps it. */
  businessName: z.string().max(200).nullish(),
  /** GSTIN billed at this address, checked like checkout's; blank clears it, left out keeps it. */
  gstin: z.string().max(20).nullish(),
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

/** A refused merge in the words the admin shows. */
function mergeRefused(reason: 'same' | 'not_found' | 'anonymised'): never {
  if (reason === 'not_found') throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
  throw new ORPCError('BAD_REQUEST', {
    message:
      reason === 'same'
        ? 'Pick a different customer to merge with.'
        : 'An erased or already merged customer cannot be merged.',
  })
}

type AddressResult = Awaited<ReturnType<typeof createAddress>>

function unwrap(result: AddressResult) {
  if (result.ok) return { id: result.id }
  throw new ORPCError('BAD_REQUEST', {
    message: Object.values(result.errors)[0] ?? 'Check the address',
    data: { errors: result.errors },
  })
}

/**
 * A GSTIN typed by staff, checked like checkout's (`validateGstin`) and stored upper case;
 * blank clears it, undefined leaves it alone.
 */
function parseGstin(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null || raw.trim() === '') return null
  const check = validateGstin(raw)
  if (check.ok) return check.gstin
  throw new ORPCError('BAD_REQUEST', {
    message: GSTIN_MESSAGES[check.reason as keyof typeof GSTIN_MESSAGES] ?? GSTIN_MESSAGES.shape,
    data: { field: 'gstin' },
  })
}

export const customersRouter = {
  list: can(permissions.CUSTOMERS_READ)
    .input(
      FiltersSchema.extend({
        /** Exactly these customers, e.g. the ones a discount is limited to. */
        ids: z.array(z.uuid()).max(PAGE_SIZE_MAX).optional(),
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
      const [addresses, phoneSuggestion] = await Promise.all([
        listAddresses(ctx, input.id),
        found.phone ? null : suggestContactPhone(ctx, input.id, settingsSecret()),
      ])
      // A contact phone the staff could take from their latest order or address (one click).
      return { ...found, addresses, phoneSuggestion }
    }),

  /**
   * Save the mobile from the customer's latest order (or saved address) as their contact phone,
   * when they have none. Worked out on the server, refused when another customer has it; consent
   * is never switched on by this.
   */
  adoptContactPhone: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const result = await adoptContactPhone(
        { tx: context.tx, storeId: context.scope.storeId },
        input.id,
        {
          secret: settingsSecret(),
          actor: {
            type: 'staff',
            id: context.scope.userId,
            label: context.session.user.name?.trim() || context.session.user.email,
          },
        },
      )
      if (result.ok) return { phone: result.phone, source: result.source }
      if (result.reason === 'not_found') {
        throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
      }
      if (result.reason === 'duplicate') {
        throw new ORPCError('CONFLICT', {
          message: 'Another customer already has this mobile number',
          data: { field: 'phone', existingId: result.existingId },
        })
      }
      throw new ORPCError('BAD_REQUEST', {
        message:
          result.reason === 'has_phone'
            ? 'This customer already has a phone number'
            : 'No mobile number on their orders or addresses',
      })
    }),

  /**
   * "WhatsApp" click to chat from the customer page: their phone and name, plus their latest
   * order's links for the order and shipping messages. No WhatsApp channel needed.
   */
  whatsappChat: can(permissions.CUSTOMERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const chat = await whatsappChatContext(
        { storeId: context.scope.storeId, tx: context.tx },
        { kind: 'customer', id: input.id },
        { storefrontUrl: loadEnv(process.env).STOREFRONT_URL, settingsSecret: settingsSecret() },
      )
      if (!chat) throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
      return chat
    }),

  /**
   * "Email customer": a plain email with the merchant's subject and message, sent through the
   * store's email channels, listed under the customer's messages and noted on their timeline.
   */
  sendEmail: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        subject: z.string().trim().min(1).max(200),
        message: z.string().trim().min(1).max(5000),
      }),
    )
    .handler(({ context, input }) =>
      emailCustomer(context.tx, context.scope.storeId, {
        customerId: input.id,
        subject: input.subject,
        message: input.message,
        author: context.session.user.email,
        settingsSecret: settingsSecret(),
      }),
    ),

  /** The merchant opened a click-to-chat WhatsApp: the line goes on the customer's Timeline. */
  noteWhatsappChat: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ id: z.uuid(), template: z.enum(WHATSAPP_CHAT_TEMPLATES) }))
    .handler(async ({ context, input }) => {
      const noted = await noteWhatsappChat(
        { storeId: context.scope.storeId, tx: context.tx },
        { kind: 'customer', id: input.id },
        { template: input.template, author: context.session.user.email },
      )
      return { noted }
    }),

  /** Rows for the Customers bulk-edit spreadsheet, in the order the ids were given. */
  sheet: can(permissions.CUSTOMERS_READ)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(5000) }))
    .handler(({ context, input }) => customerSheet(context.tx, input.ids, settingsSecret())),

  /**
   * Add a customer by hand ("Add customer" on the list). Needs an email or a mobile number;
   * one another customer already has is refused with CONFLICT and who has it, never merged.
   */
  create: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        name: z.string().trim().max(200).optional(),
        email: z.string().trim().max(254).optional(),
        phone: lenientPhone(30).optional(),
        note: z.string().trim().max(2000).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
        consent: z
          .object({ email: z.boolean(), whatsapp: z.boolean(), sms: z.boolean() })
          .partial()
          .optional(),
        address: AddressSchema.omit({ isDefault: true, isDefaultBilling: true }).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const result = await createCustomer(
        { tx: context.tx, storeId: context.scope.storeId },
        input,
        {
          secret: settingsSecret(),
          actor: {
            type: 'staff',
            id: context.scope.userId,
            label: context.session.user.name?.trim() || context.session.user.email,
          },
        },
      )
      if (result.ok) return { id: result.id }
      if (result.reason === 'duplicate') {
        throw new ORPCError('CONFLICT', {
          message:
            result.field === 'email'
              ? 'A customer with this email already exists'
              : 'A customer with this mobile number already exists',
          data: { field: result.field, existingId: result.existingId },
        })
      }
      throw new ORPCError('BAD_REQUEST', {
        message: Object.values(result.errors)[0] ?? 'Check the customer details',
        data: { errors: result.errors },
      })
    }),

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

  /** Make one saved address the customer's default (the profile card shows it). */
  setDefaultAddress: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ customerId: z.uuid(), addressId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertCustomer(context.tx, input.customerId)
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      const done = await setDefaultAddress(ctx, input.customerId, input.addressId)
      if (!done) throw new ORPCError('NOT_FOUND', { message: 'Address not found' })
      return { id: input.addressId }
    }),

  /** Make one saved address the customer's default billing address (draft orders bill it). */
  setDefaultBillingAddress: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ customerId: z.uuid(), addressId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await assertCustomer(context.tx, input.customerId)
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      const done = await setDefaultBillingAddress(ctx, input.customerId, input.addressId)
      if (!done) throw new ORPCError('NOT_FOUND', { message: 'Address not found' })
      return { id: input.addressId }
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
        /** A new email; one another customer already has is refused (merge them instead). */
        email: z.email().trim().toLowerCase().max(254).nullable().optional(),
        phone: lenientPhone(30).nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
        note: z.string().trim().max(2000).nullable().optional(),
        acceptsMarketing: z.boolean().optional(),
        /** Business details for B2B invoices; blank clears. */
        gstin: z.string().trim().max(20).nullable().optional(),
        businessName: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .handler(async ({ context, input: { id, acceptsMarketing, gstin, ...rest } }) => {
      if (rest.email) {
        const ctx = { tx: context.tx, storeId: context.scope.storeId }
        const existingId = await customerWithEmail(ctx, rest.email, id)
        if (existingId) {
          throw new ORPCError('CONFLICT', {
            message:
              'Another customer already has this email. Use "Merge with another customer" to make them one.',
            data: { field: 'email', existingId },
          })
        }
      }
      const patch = {
        ...rest,
        ...(gstin === undefined ? {} : { gstin: parseGstin(gstin) }),
        ...(rest.businessName === undefined ? {} : { businessName: rest.businessName || null }),
      }
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
      const updated = await updateCustomer(context.tx, id, patch, settingsSecret())
      if (updated) {
        await recordCustomerChange(context.tx, context.scope.storeId, id, 'updated')
      }
      return updated
    }),

  /**
   * The merge dialog's summary: both customers and what would move from `mergeId` onto
   * `keepId` (orders, addresses, store credit, gift cards, sign-ins, carts, notes, reviews).
   */
  previewMerge: can(permissions.CUSTOMERS_READ)
    .input(z.object({ keepId: z.uuid(), mergeId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const result = await previewCustomerMerge(
        { tx: context.tx, storeId: context.scope.storeId },
        input.keepId,
        input.mergeId,
      )
      if (!result.ok) mergeRefused(result.reason)
      return result
    }),

  /**
   * "Merge with another customer": everything `mergeId` holds moves onto `keepId` in one
   * transaction, with the email, phone and name chosen in `keep`; the other record is closed
   * (erased stub) and its sign-ins end. It removes a customer, so it needs delete too.
   */
  merge: can(permissions.CUSTOMERS_WRITE, () => [permissions.CUSTOMERS_DELETE])
    .input(
      z.object({
        keepId: z.uuid(),
        mergeId: z.uuid(),
        keep: z
          .object({
            email: z.enum(['kept', 'merged']),
            phone: z.enum(['kept', 'merged']),
            name: z.enum(['kept', 'merged']),
          })
          .partial()
          .optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const result = await mergeCustomers(
        { tx: context.tx, storeId: context.scope.storeId },
        {
          ...input,
          author: context.session.user.email,
          actor: {
            type: 'staff',
            id: context.scope.userId,
            label: context.session.user.name?.trim() || context.session.user.email,
          },
        },
      ).catch((err: unknown) => {
        if (err instanceof StoreCreditError) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        throw err
      })
      if (!result.ok) mergeRefused(result.reason)
      return result
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
