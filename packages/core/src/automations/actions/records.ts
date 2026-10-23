/** SOURCE OF TRUTH: metafield and collection automation actions — WHAT: set a metafield on the run's order, customer or product (through `setMetafields`, so values are validated like the admin form) and add/remove the product in a manual collection, each a no-op when nothing would change / WHY: Flow's "Update metafield" and "Add to collection" steps on the same services the admin uses. Server-only. Design §8.4. */
import {
  collection,
  collectionProduct,
  type MetafieldOwnerType,
  metafield,
  metafieldDefinition,
  type StoreTx,
} from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { noteProductsChanged } from '../../catalog/changes'
import { CommerceError } from '../../errors'
import { setMetafields } from '../../metaobjects/service'
import { insertOutboxEvent } from '../../outbox/write'
import { customerIdOf } from '../conditions/loaders'
import { type ActionContext, type ActionExecutor, AutomationActionError } from '../executor'
import { noteOnOrder, subjectId } from './shared'

// ---------------------------------------------------------------------------------------------
// Set metafield
// ---------------------------------------------------------------------------------------------

type MetafieldConfig = { namespace: string; key: string; value: string }

/** Types whose stored value is JSON (an object or rows), typed as JSON text in the step. */
const JSON_TYPES = new Set(['rich_text', 'money', 'link', 'rating', 'measurement', 'group'])

/**
 * The rendered text as the value the definition expects: JSON for structured types and
 * lists written as `[...]`, other lists one item per line (or comma); numbers, booleans and
 * dates stay text, which the validator parses.
 */
function metafieldInput(text: string, type: string, list: boolean): unknown {
  const t = text.trim()
  const json = () => {
    try {
      return JSON.parse(t) as unknown
    } catch {
      return t
    }
  }
  if (list) {
    if (t.startsWith('[')) return json()
    return t
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (JSON_TYPES.has(type) && (t.startsWith('{') || t.startsWith('['))) return json()
  return t
}

async function ownerFor(
  tx: StoreTx,
  ctx: ActionContext,
  ownerType: MetafieldOwnerType,
): Promise<string | null> {
  if (ownerType === 'customer') return customerIdOf(tx, ctx.subject)
  return subjectId(ctx, `an ${ownerType === 'order' ? 'order' : 'product'}`)
}

async function definitionFor(tx: StoreTx, ownerType: MetafieldOwnerType, c: MetafieldConfig) {
  const [def] = await tx
    .select()
    .from(metafieldDefinition)
    .where(
      and(
        eq(metafieldDefinition.ownerType, ownerType),
        eq(metafieldDefinition.namespace, c.namespace.trim()),
        eq(metafieldDefinition.key, c.key.trim()),
      ),
    )
  return def ?? null
}

async function currentValue(tx: StoreTx, definitionId: string, ownerId: string) {
  const [row] = await tx
    .select({ value: metafield.value })
    .from(metafield)
    .where(and(eq(metafield.definitionId, definitionId), eq(metafield.ownerId, ownerId)))
  return row ? row.value : null
}

function metafieldExecutor(
  ownerType: 'order' | 'customer' | 'product',
): ActionExecutor<MetafieldConfig> {
  const noField = (c: MetafieldConfig) =>
    new AutomationActionError(
      `There is no ${ownerType} field ${c.namespace}.${c.key}. Add it in Settings → Custom data`,
      { retryable: false },
    )
  return {
    id: `${ownerType}.set_metafield`,
    async run({ tx, ctx, config }) {
      const ownerId = await ownerFor(tx, ctx, ownerType)
      if (!ownerId) return { noop: true, summary: `No ${ownerType} to update` }
      const def = await definitionFor(tx, ownerType, config)
      if (!def) throw noField(config)
      const input = metafieldInput(ctx.render(config.value), def.type, def.list)
      const before = await currentValue(tx, def.id, ownerId)
      try {
        await setMetafields(tx, ctx.storeId, { ownerType, ownerId, values: { [def.id]: input } })
      } catch (err) {
        if (err instanceof CommerceError) {
          throw new AutomationActionError(err.message, { retryable: false, cause: err })
        }
        throw err
      }
      const after = await currentValue(tx, def.id, ownerId)
      const field = `${def.namespace}.${def.key}`
      if (JSON.stringify(before) === JSON.stringify(after)) {
        return { noop: true, summary: `${field} already had this value` }
      }
      if (ownerType === 'order') await noteOnOrder(tx, ctx, ownerId, `${def.name} set`)
      return {
        summary: `Set ${field}`,
        output: { field, value: after },
        changed:
          ownerType === 'customer' && ctx.subject.type !== 'customer'
            ? [{ type: 'customer', id: ownerId }]
            : undefined,
      }
    },
    async preview({ tx, ctx, config }) {
      const ownerId = await ownerFor(tx, ctx, ownerType)
      if (!ownerId) return { summary: `No ${ownerType} to update`, wouldRun: false }
      const def = await definitionFor(tx, ownerType, config)
      if (!def) return { summary: noField(config).message, wouldRun: false }
      const text = ctx.render(config.value)
      return {
        summary: `Would set ${def.namespace}.${def.key} to "${text}"`,
        wouldRun: true,
        output: { value: metafieldInput(text, def.type, def.list) },
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Add / remove the product in a manual collection
// ---------------------------------------------------------------------------------------------

type CollectionConfig = { collectionId: string }

async function manualCollection(tx: StoreTx, id: string) {
  const [c] = await tx
    .select({ id: collection.id, title: collection.title, kind: collection.kind })
    .from(collection)
    .where(eq(collection.id, id))
  if (!c) {
    throw new AutomationActionError('The collection no longer exists', { retryable: false })
  }
  if (c.kind !== 'manual') {
    throw new AutomationActionError(
      `${c.title} picks its products by rules; only manual collections can be changed here`,
      { retryable: false },
    )
  }
  return c
}

async function isMember(tx: StoreTx, collectionId: string, productId: string) {
  const [row] = await tx
    .select({ id: collectionProduct.id })
    .from(collectionProduct)
    .where(
      and(
        eq(collectionProduct.collectionId, collectionId),
        eq(collectionProduct.productId, productId),
      ),
    )
  return !!row
}

async function noteChanged(tx: StoreTx, ctx: ActionContext, productId: string) {
  await noteProductsChanged(tx, [productId], ctx.storeId)
  await insertOutboxEvent(tx, ctx.storeId, 'product.updated', { productId }, { cause: ctx.cause })
}

function collectionExecutor(mode: 'add' | 'remove'): ActionExecutor<CollectionConfig> {
  return {
    id: `collection.${mode}_product`,
    async run({ tx, ctx, config }) {
      const productId = subjectId(ctx, 'a product')
      const c = await manualCollection(tx, config.collectionId)
      const changed = [{ type: 'collection', id: c.id }]
      if (mode === 'add') {
        const [pos] = await tx
          .select({ next: sql<number>`coalesce(max(${collectionProduct.position}) + 1, 0)::int` })
          .from(collectionProduct)
          .where(eq(collectionProduct.collectionId, c.id))
        const [row] = await tx
          .insert(collectionProduct)
          .values({ storeId: ctx.storeId, collectionId: c.id, productId, position: pos?.next ?? 0 })
          .onConflictDoNothing()
          .returning({ id: collectionProduct.id })
        if (!row) return { noop: true, summary: `Already in ${c.title}` }
        await noteChanged(tx, ctx, productId)
        return { summary: `Added to ${c.title}`, changed, output: { collection: c.title } }
      }
      const gone = await tx
        .delete(collectionProduct)
        .where(
          and(eq(collectionProduct.collectionId, c.id), eq(collectionProduct.productId, productId)),
        )
        .returning({ id: collectionProduct.id })
      if (gone.length === 0) return { noop: true, summary: `Not in ${c.title}` }
      await noteChanged(tx, ctx, productId)
      return { summary: `Removed from ${c.title}`, changed, output: { collection: c.title } }
    },
    async preview({ tx, ctx, config }) {
      const productId = subjectId(ctx, 'a product')
      let c: { id: string; title: string }
      try {
        c = await manualCollection(tx, config.collectionId)
      } catch (err) {
        return { summary: (err as Error).message, wouldRun: false }
      }
      const member = await isMember(tx, c.id, productId)
      if (mode === 'add') {
        return member
          ? { summary: `Already in ${c.title}`, wouldRun: false }
          : { summary: `Would add the product to ${c.title}`, wouldRun: true }
      }
      return member
        ? { summary: `Would remove the product from ${c.title}`, wouldRun: true }
        : { summary: `Not in ${c.title}`, wouldRun: false }
    },
  }
}

export const recordExecutors = (): ActionExecutor<never>[] =>
  [
    metafieldExecutor('order'),
    metafieldExecutor('customer'),
    metafieldExecutor('product'),
    collectionExecutor('add'),
    collectionExecutor('remove'),
  ] as unknown as ActionExecutor<never>[]
