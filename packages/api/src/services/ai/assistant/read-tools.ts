/**
 * The assistant's catalogue and order lookups (READ-ONLY), next to the store totals in
 * `../store-tools.ts`. Same rules: each opens its own `withStore` for the engine's runtime
 * store, returns labelled `facts`, and passes merchant or customer text through `guardData`
 * (instructions hidden, the message tainted). The only personal detail any tool sends is an
 * order's customer first name (`orderDetails`, for reply drafts), and it says so in `shared`.
 */
import { type AiToolSet, defineAiTool, descriptionText, guardData } from '@commerce/ai'
import { notSystemTest } from '@commerce/core'
import {
  collection,
  collectionProduct,
  customer,
  inventoryLevel,
  order,
  orderLine,
  orderNote,
  product,
  sellableLevel,
  variant,
} from '@commerce/db'
import {
  and,
  arrayContains,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  max,
  min,
  ne,
  type SQL,
  sql,
  sum,
} from 'drizzle-orm'
import { z } from 'zod'
import { type AnswerTable, answerTable } from '../answer-table'
import { day, type Fact, money, read, safeTitle, type ToolEnv } from '../store-tools'
import { findCollections, oneProduct, ProposalProblem } from './actions/resolve'

/** `table`: the rows for the admin only; the assistant takes it off before the model reads it. */
export type ReadOutput = { facts: Fact[]; shared?: string[]; table?: AnswerTable }

function guarded(env: ToolEnv, text: string | null | undefined, max = 400): string {
  const g = guardData(text, max)
  if (g.flagged && env.taint) env.taint.flagged = true
  return g.text
}

/** Phone numbers and emails a customer typed into a note never reach the model. */
function scrubContact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email hidden]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[number hidden]')
}

function problem(err: unknown): ReadOutput {
  if (err instanceof ProposalProblem) return { facts: [{ label: 'Not found', value: err.message }] }
  throw err
}

export function readTools(env: ToolEnv): AiToolSet {
  return {
    findProducts: defineAiTool({
      description:
        'Find products by words in the title, a tag or a collection. Returns each product handle (use it in other tools), price, stock and status.',
      input: z.object({
        search: z.string().max(100).optional(),
        tag: z.string().max(60).optional(),
        collection: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ReadOutput> => {
          const where: SQL[] = [notSystemTest, ne(product.status, 'archived')]
          if (input.search?.trim())
            where.push(ilike(product.title, `%${input.search.trim().replace(/[%_]/g, '')}%`))
          if (input.tag?.trim()) where.push(arrayContains(product.tags, [input.tag.trim()]))
          if (input.collection) {
            const { found } = await findCollections(tx, [input.collection])
            if (!found[0])
              return {
                facts: [{ label: 'Collection', value: `none called "${input.collection}"` }],
              }
            const members = tx
              .select({ id: collectionProduct.productId })
              .from(collectionProduct)
              .where(eq(collectionProduct.collectionId, found[0].id))
            where.push(inArray(product.id, members))
          }
          const rows = await tx
            .select({
              handle: product.handle,
              title: product.title,
              status: product.status,
              low: min(variant.pricePaise),
              high: max(variant.pricePaise),
              stock: sql<number>`coalesce(sum(${inventoryLevel.onHand} - ${inventoryLevel.reserved}), 0)::int`,
            })
            .from(product)
            .leftJoin(variant, and(eq(variant.productId, product.id), isNull(variant.archivedAt)))
            .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
            .where(and(...where))
            .groupBy(product.id)
            .orderBy(asc(product.title))
            .limit(input.limit)
          const [total] = await tx
            .select({ n: count() })
            .from(product)
            .where(and(...where))
          if (!rows.length) return { facts: [{ label: 'Products found', value: 'none' }] }
          const titles = rows.map((r) => safeTitle(env, r.title))
          const price = (r: (typeof rows)[number]) =>
            r.low === r.high
              ? money(env, r.low ?? 0)
              : `${money(env, r.low ?? 0)} to ${money(env, r.high ?? 0)}`
          return {
            table: answerTable({
              columns: [
                { id: 'product', kind: 'text' },
                { id: 'handle', kind: 'text' },
                { id: 'price', kind: 'text' },
                { id: 'available', kind: 'count' },
                { id: 'status', kind: 'label' },
              ],
              rows: rows.map((r, i) => ({
                key: r.handle,
                values: {
                  product: titles[i] ?? '',
                  handle: r.handle,
                  price: price(r),
                  available: r.stock,
                  status: r.status,
                },
              })),
            }),
            facts: [
              {
                label: 'Products found',
                value: `${total?.n ?? rows.length}${(total?.n ?? 0) > rows.length ? ` (showing ${rows.length})` : ''}`,
              },
              ...rows.map((r, i) => ({
                label: titles[i] ?? '',
                value: `handle ${r.handle}, ${price(r)}, ${r.stock} in stock, ${r.status}`,
              })),
            ],
          }
        }),
    }),

    productDetails: defineAiTool({
      description:
        "One product's details: title, handle, status, prices, stock, tags, type, vendor, current description and search text.",
      input: z.object({ product: z.string().max(200).describe('Handle (best) or title.') }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ReadOutput> => {
          try {
            const found = await oneProduct(tx, input.product)
            const [row] = await tx.select().from(product).where(eq(product.id, found.id))
            if (!row) return { facts: [] }
            const variants = await tx
              .select({
                title: variant.title,
                price: variant.pricePaise,
                mrp: variant.mrpPaise,
                requiresShipping: variant.requiresShipping,
              })
              .from(variant)
              .where(and(eq(variant.productId, row.id), isNull(variant.archivedAt)))
              .orderBy(asc(variant.position))
              .limit(10)
            const [stock] = await tx
              .select({
                n: sum(sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved}`).mapWith(Number),
              })
              .from(inventoryLevel)
              .innerJoin(variant, and(eq(variant.id, inventoryLevel.variantId), sellableLevel))
              .where(eq(variant.productId, row.id))
            return {
              facts: [
                { label: 'Title', value: safeTitle(env, row.title) },
                { label: 'Handle', value: row.handle },
                { label: 'Status', value: row.status },
                ...variants.map((v) => ({
                  label: v.title === 'Default' ? 'Price' : `Price, ${safeTitle(env, v.title)}`,
                  value:
                    v.price == null
                      ? 'not set yet'
                      : `${money(env, v.price)}${v.mrp ? ` (MRP ${money(env, v.mrp)})` : ''}`,
                })),
                // "This is a physical product" off: no shipping charge, never in a shipment.
                ...(variants.some((v) => !v.requiresShipping)
                  ? [
                      {
                        label: 'Needs no shipping',
                        value: variants
                          .filter((v) => !v.requiresShipping)
                          .map((v) => safeTitle(env, v.title))
                          .join(', '),
                      },
                    ]
                  : []),
                { label: 'In stock', value: String(stock?.n ?? 0) },
                { label: 'Tags', value: guarded(env, row.tags.join(', '), 300) || 'none' },
                { label: 'Type', value: guarded(env, row.productType, 100) || 'not set' },
                { label: 'Brand', value: guarded(env, row.vendor, 100) || 'not set' },
                {
                  label: 'Description',
                  value: guarded(env, descriptionText(row.description), 900) || 'empty',
                },
                { label: 'Search title', value: guarded(env, row.seoTitle, 120) || 'not set' },
                {
                  label: 'Search description',
                  value: guarded(env, row.seoDescription, 320) || 'not set',
                },
              ],
            }
          } catch (err) {
            return problem(err)
          }
        }),
    }),

    listCollections: defineAiTool({
      description:
        "The store's collections: title, handle, manual or automatic, and how many products.",
      input: z.object({}),
      risk: 'read',
      run: (_input, runtime) =>
        read(env, runtime, async (tx): Promise<ReadOutput> => {
          const rows = await tx
            .select({
              title: collection.title,
              handle: collection.handle,
              kind: collection.kind,
              status: collection.status,
              products: count(collectionProduct.id),
            })
            .from(collection)
            .leftJoin(collectionProduct, eq(collectionProduct.collectionId, collection.id))
            .groupBy(collection.id)
            .orderBy(asc(collection.title))
            .limit(40)
          if (!rows.length) return { facts: [{ label: 'Collections', value: 'none yet' }] }
          const titles = rows.map((r) => safeTitle(env, r.title))
          return {
            table: answerTable({
              columns: [
                { id: 'collection', kind: 'text' },
                { id: 'handle', kind: 'text' },
                { id: 'products', kind: 'count' },
                { id: 'status', kind: 'label' },
              ],
              rows: rows.map((r, i) => ({
                key: r.handle,
                values: {
                  collection: titles[i] ?? '',
                  handle: r.handle,
                  products: r.products,
                  status: r.status,
                },
              })),
            }),
            facts: rows.map((r, i) => ({
              label: titles[i] ?? '',
              value: `handle ${r.handle}, ${r.kind}, ${r.products} products${r.status === 'draft' ? ', hidden' : ''}`,
            })),
          }
        }),
    }),

    orderDetails: defineAiTool({
      description:
        "One order by number: status, payment, shipping, total, items, age, notes count and the customer's first name (for a reply draft). No contact details.",
      input: z.object({ number: z.number().int().min(1) }),
      risk: 'read',
      run: (input, runtime) =>
        read(env, runtime, async (tx): Promise<ReadOutput> => {
          const [row] = await tx
            .select({
              id: order.id,
              number: order.number,
              status: order.status,
              paymentStatus: order.paymentStatus,
              fulfillmentStatus: order.fulfillmentStatus,
              totalPaise: order.totalPaise,
              placedAt: order.placedAt,
              customerNote: order.customerNote,
              name: customer.name,
            })
            .from(order)
            .leftJoin(customer, eq(customer.id, order.customerId))
            .where(eq(order.number, input.number))
          if (!row)
            return {
              facts: [{ label: `Order #${input.number}`, value: 'not found in this store' }],
            }
          const lines = await tx
            .select({
              title: orderLine.title,
              variantTitle: orderLine.variantTitle,
              quantity: orderLine.quantity,
            })
            .from(orderLine)
            .where(eq(orderLine.orderId, row.id))
            .limit(12)
          const [notes] = await tx
            .select({ n: count() })
            .from(orderNote)
            .where(eq(orderNote.orderId, row.id))
          const first = (row.name ?? '').trim().split(/\s+/)[0] ?? ''
          const placed = row.placedAt
          const age = placed
            ? Math.floor((env.now().getTime() - placed.getTime()) / 86_400_000)
            : null
          return {
            facts: [
              { label: 'Order', value: `#${row.number}` },
              {
                label: 'Status',
                value: `${row.status}, payment ${row.paymentStatus}, shipping ${row.fulfillmentStatus}`,
              },
              { label: 'Total', value: money(env, row.totalPaise) },
              ...(placed
                ? [{ label: 'Placed', value: `${day(env, placed)} (${age} days ago)` }]
                : []),
              ...lines.map((l) => ({
                label: safeTitle(env, l.title ?? 'Item'),
                value: `${l.quantity} ×${l.variantTitle && l.variantTitle !== 'Default' ? ` ${safeTitle(env, l.variantTitle)}` : ''}`,
              })),
              { label: 'Notes on the timeline', value: String(notes?.n ?? 0) },
              ...(row.customerNote
                ? [
                    {
                      label: 'Customer note',
                      value: guarded(env, scrubContact(row.customerNote), 300),
                    },
                  ]
                : []),
              ...(first ? [{ label: 'Customer first name', value: guarded(env, first, 40) }] : []),
            ],
            shared: [
              ...(first ? ['customer first name'] : []),
              ...(row.customerNote ? ['customer note (phone numbers and emails hidden)'] : []),
            ],
          }
        }),
    }),
  }
}
