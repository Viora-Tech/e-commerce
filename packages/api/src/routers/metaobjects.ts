import {
  createDefinition,
  createDefinitionFromPreset,
  createEntry,
  createMetafieldDefinition,
  deleteDefinition,
  deleteEntries,
  deleteMetafieldDefinition,
  FromPresetInputSchema,
  filledFieldKeys,
  getDefinition,
  getEntry,
  getMetafields,
  InvalidMetaobject,
  listDefinitions,
  listEntries,
  listMetafieldDefinitions,
  METAFIELD_OWNER_PERMISSIONS,
  METAFIELD_READ_PERMISSIONS,
  METAFIELD_WRITE_PERMISSIONS,
  MetafieldDefinitionWriteSchema,
  type MetafieldOwnerType,
  MetafieldOwnerTypeSchema,
  MetaobjectDefinitionWriteSchema,
  MetaobjectWriteSchema,
  permissions,
  REFERENCE_KINDS,
  referenceOptions,
  setMetafields,
  updateDefinition,
  updateEntry,
  updateMetafieldDefinition,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import {
  BULK_MAX,
  can,
  canAny,
  PAGE_MAX,
  PAGE_SIZE_MAX,
  SEARCH_MAX,
  type StoreScope,
} from '../procedures'

/** Validation failures answer 400 with per-field messages the forms show inline. */
async function invalidToBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof InvalidMetaobject) {
      throw new ORPCError('BAD_REQUEST', {
        message: err.errors.join('. '),
        data: { fieldErrors: err.fieldErrors },
      })
    }
    throw err
  }
}

const read = () => can(permissions.CONTENT_READ)
const write = () => can(permissions.CONTENT_WRITE)
/** Content types and extra fields themselves: their shape, not their entries or values. */
const manageTypes = () => can(permissions.CONTENT_MANAGE_TYPES)
const id = z.object({ id: z.uuid() })

/** Refuses unless the member may read (or write) extra fields on this kind of record. */
function assertOwnerAccess(
  scope: Pick<StoreScope, 'can'>,
  ownerType: MetafieldOwnerType,
  mode: 'read' | 'write',
) {
  const needed = METAFIELD_OWNER_PERMISSIONS[ownerType][mode]
  if (scope.can(needed)) return
  // Whoever manages the fields may list them for any owner (Settings → Custom data).
  if (mode === 'read' && scope.can(permissions.CONTENT_MANAGE_TYPES)) return
  throw new ORPCError('FORBIDDEN', { message: `Your role does not allow ${needed}` })
}

/** The shop's extra fields belong to the store itself, whatever id the caller sent. */
const ownerIdFor = (
  input: { ownerType: MetafieldOwnerType; ownerId?: string | undefined },
  storeId: string,
) => (input.ownerType === 'shop' ? storeId : input.ownerId)

const OwnerInput = z
  .object({ ownerType: MetafieldOwnerTypeSchema, ownerId: z.uuid().optional() })
  .refine((o) => o.ownerType === 'shop' || o.ownerId !== undefined, {
    message: 'Say which record the extra fields belong to',
    path: ['ownerId'],
  })

/** Metaobject definitions and entries (Content → Content types in the admin). */
export const metaobjectsRouter = {
  definitions: read().handler(({ context }) => listDefinitions(context.tx)),

  definition: read()
    .input(z.union([z.object({ id: z.uuid() }), z.object({ type: z.string().max(64) })]))
    .handler(async ({ context, input }) => {
      const row = await getDefinition(context.tx, input)
      if (!row) {
        throw new ORPCError('NOT_FOUND', {
          message: 'This content type no longer exists. Go back to Content types and open another',
        })
      }
      /* Per field key, how many entries hold a value: the editor locks those fields' type. */
      return { ...row, filled: await filledFieldKeys(context.tx, row.id) }
    }),

  createDefinition: manageTypes()
    .input(MetaobjectDefinitionWriteSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(() => createDefinition(context.tx, context.scope.storeId, input)),
    ),

  /** A ready-made content type (Size guide, FAQ, ...) from `METAOBJECT_PRESETS`. */
  fromPreset: manageTypes()
    .input(FromPresetInputSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(() =>
        createDefinitionFromPreset(context.tx, context.scope.storeId, input),
      ),
    ),

  updateDefinition: manageTypes()
    .input(z.object({ id: z.uuid(), write: MetaobjectDefinitionWriteSchema }))
    .handler(({ context, input }) =>
      invalidToBadRequest(() => updateDefinition(context.tx, input.id, input.write)),
    ),

  deleteDefinition: manageTypes()
    .input(id)
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => {
        await deleteDefinition(context.tx, input.id)
        return { ok: true as const }
      }),
    ),

  entries: read()
    .input(
      z.object({
        definitionId: z.uuid(),
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        query: z.string().trim().max(SEARCH_MAX).optional(),
      }),
    )
    .handler(({ context, input }) => listEntries(context.tx, input)),

  entry: read()
    .input(id)
    .handler(async ({ context, input }) => {
      const row = await getEntry(context.tx, input.id)
      if (!row) {
        throw new ORPCError('NOT_FOUND', {
          message: 'This entry was deleted. Go back to the list and open another',
        })
      }
      return row
    }),

  createEntry: write()
    .input(MetaobjectWriteSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(() => createEntry(context.tx, context.scope.storeId, input)),
    ),

  updateEntry: write()
    .input(z.object({ id: z.uuid(), write: MetaobjectWriteSchema }))
    .handler(({ context, input }) =>
      invalidToBadRequest(() => updateEntry(context.tx, input.id, input.write)),
    ),

  deleteEntries: write()
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) }))
    .handler(async ({ context, input }) => ({
      deleted: await deleteEntries(context.tx, input.ids),
    })),

  /** Rows for reference pickers: search results, or labels for ids already chosen. */
  references: read()
    .input(
      z.object({
        kind: z.enum(REFERENCE_KINDS),
        query: z.string().trim().max(SEARCH_MAX).optional(),
        ids: z.array(z.uuid()).max(250).optional(),
        definitionId: z.uuid().optional(),
      }),
    )
    .handler(({ context, input }) => referenceOptions(context.tx, input)),

  /*
   * Metafields ("Extra fields": Settings → Custom data, and the cards on product, variant,
   * collection, customer, order, page and blog post pages, plus the store's own). Values need
   * the owner's own access (METAFIELD_OWNER_PERMISSIONS); the definitions need manage_types.
   */

  metafieldDefinitions: canAny(METAFIELD_READ_PERMISSIONS)
    .input(z.object({ ownerType: MetafieldOwnerTypeSchema }))
    .handler(({ context, input }) => {
      assertOwnerAccess(context.scope, input.ownerType, 'read')
      return listMetafieldDefinitions(context.tx, input.ownerType)
    }),

  createMetafieldDefinition: manageTypes()
    .input(MetafieldDefinitionWriteSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(() =>
        createMetafieldDefinition(context.tx, context.scope.storeId, input),
      ),
    ),

  updateMetafieldDefinition: manageTypes()
    .input(z.object({ id: z.uuid(), write: MetafieldDefinitionWriteSchema }))
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => {
        await updateMetafieldDefinition(context.tx, input.id, input.write)
        return { ok: true as const }
      }),
    ),

  deleteMetafieldDefinition: manageTypes()
    .input(id)
    .handler(async ({ context, input }) => {
      await deleteMetafieldDefinition(context.tx, input.id)
      return { ok: true as const }
    }),

  metafields: canAny(METAFIELD_READ_PERMISSIONS)
    .input(OwnerInput)
    .handler(({ context, input }) => {
      assertOwnerAccess(context.scope, input.ownerType, 'read')
      const ownerId = ownerIdFor(input, context.scope.storeId) as string
      return getMetafields(context.tx, input.ownerType, ownerId)
    }),

  setMetafields: canAny(METAFIELD_WRITE_PERMISSIONS)
    .input(OwnerInput.and(z.object({ values: z.record(z.uuid(), z.unknown()) })))
    .handler(({ context, input }) => {
      assertOwnerAccess(context.scope, input.ownerType, 'write')
      const ownerId = ownerIdFor(input, context.scope.storeId) as string
      return invalidToBadRequest(async () => {
        await setMetafields(context.tx, context.scope.storeId, {
          ownerType: input.ownerType,
          ownerId,
          values: input.values,
        })
        return { ok: true as const }
      })
    }),
}
