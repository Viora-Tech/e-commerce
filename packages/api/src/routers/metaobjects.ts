import {
  createDefinition,
  createEntry,
  createMetafieldDefinition,
  deleteDefinition,
  deleteEntries,
  deleteMetafieldDefinition,
  getDefinition,
  getEntry,
  getMetafields,
  InvalidMetaobject,
  listDefinitions,
  listEntries,
  listMetafieldDefinitions,
  MetafieldDefinitionWriteSchema,
  MetafieldOwnerTypeSchema,
  MetaobjectDefinitionWriteSchema,
  MetaobjectWriteSchema,
  permissions,
  referenceOptions,
  setMetafields,
  updateDefinition,
  updateEntry,
  updateMetafieldDefinition,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

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
const id = z.object({ id: z.uuid() })

/** Metaobject definitions and entries (Content → Metaobjects). */
export const metaobjectsRouter = {
  definitions: read().handler(({ context }) => listDefinitions(context.tx)),

  definition: read()
    .input(z.union([z.object({ id: z.uuid() }), z.object({ type: z.string().max(64) })]))
    .handler(async ({ context, input }) => {
      const row = await getDefinition(context.tx, input)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'This metaobject no longer exists' })
      return row
    }),

  createDefinition: write()
    .input(MetaobjectDefinitionWriteSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(() => createDefinition(context.tx, context.scope.storeId, input)),
    ),

  updateDefinition: write()
    .input(z.object({ id: z.uuid(), write: MetaobjectDefinitionWriteSchema }))
    .handler(({ context, input }) =>
      invalidToBadRequest(() => updateDefinition(context.tx, input.id, input.write)),
    ),

  deleteDefinition: write()
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
        page: z.number().int().min(1).max(10_000).default(1),
        perPage: z.number().int().min(1).max(100).default(25),
        query: z.string().trim().max(200).optional(),
      }),
    )
    .handler(({ context, input }) => listEntries(context.tx, input)),

  entry: read()
    .input(id)
    .handler(async ({ context, input }) => {
      const row = await getEntry(context.tx, input.id)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'This entry no longer exists' })
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
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(200) }))
    .handler(async ({ context, input }) => ({
      deleted: await deleteEntries(context.tx, input.ids),
    })),

  /** Rows for reference pickers: search results, or labels for ids already chosen. */
  references: read()
    .input(
      z.object({
        kind: z.enum(['product', 'collection', 'metaobject', 'file']),
        query: z.string().trim().max(200).optional(),
        ids: z.array(z.uuid()).max(250).optional(),
        definitionId: z.uuid().optional(),
      }),
    )
    .handler(({ context, input }) => referenceOptions(context.tx, input)),

  /* Product and collection metafields (Settings → Custom data, and the product/collection forms). */

  metafieldDefinitions: can(permissions.PRODUCTS_READ)
    .input(z.object({ ownerType: MetafieldOwnerTypeSchema }))
    .handler(({ context, input }) => listMetafieldDefinitions(context.tx, input.ownerType)),

  createMetafieldDefinition: can(permissions.SETTINGS_MANAGE)
    .input(MetafieldDefinitionWriteSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(() =>
        createMetafieldDefinition(context.tx, context.scope.storeId, input),
      ),
    ),

  updateMetafieldDefinition: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid(), write: MetafieldDefinitionWriteSchema }))
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => {
        await updateMetafieldDefinition(context.tx, input.id, input.write)
        return { ok: true as const }
      }),
    ),

  deleteMetafieldDefinition: can(permissions.SETTINGS_MANAGE)
    .input(id)
    .handler(async ({ context, input }) => {
      await deleteMetafieldDefinition(context.tx, input.id)
      return { ok: true as const }
    }),

  metafields: can(permissions.PRODUCTS_READ)
    .input(z.object({ ownerType: MetafieldOwnerTypeSchema, ownerId: z.uuid() }))
    .handler(({ context, input }) => getMetafields(context.tx, input.ownerType, input.ownerId)),

  setMetafields: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        ownerType: MetafieldOwnerTypeSchema,
        ownerId: z.uuid(),
        values: z.record(z.uuid(), z.unknown()),
      }),
    )
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => {
        await setMetafields(context.tx, context.scope.storeId, input)
        return { ok: true as const }
      }),
    ),
}
