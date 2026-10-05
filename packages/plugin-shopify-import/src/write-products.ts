import {
  createProduct,
  type ProductWrite,
  slugify,
  updateProduct,
  upsertImportedRedirect,
} from '@commerce/core'
import { product, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { mapLimit } from './concurrency'
import { htmlToRichText, replaceImageSources } from './html'
import {
  errorMessage,
  findMapping,
  type ImportContext,
  type MappingRow,
  saveMapping,
  saveMappings,
  writeBatch,
} from './runtime'
import type { NProduct } from './types'

/** How many images (product images, or a body's inline images) download at once. */
const IMAGE_CONCURRENCY = 10

const clip = (value: string | null, max: number) => (value ? value.slice(0, max) : null)

/** Our handle for a source handle: Shopify allows characters ours do not. */
export function localHandle(handle: string): string {
  return slugify(handle) || 'product'
}

/** The mapping key: the Shopify id when known, else the handle (CSV exports carry no ids). */
export const productSourceId = (p: Pick<NProduct, 'sourceId' | 'handle'>) =>
  p.sourceId ?? `handle:${p.handle.toLowerCase()}`

async function matchProduct(tx: StoreTx, p: NProduct): Promise<string | null> {
  const mapped = await findMapping(tx, 'products', productSourceId(p))
  if (mapped) {
    const [row] = await tx.select({ id: product.id }).from(product).where(eq(product.id, mapped))
    if (row) return row.id
  }
  const [byHandle] = await tx
    .select({ id: product.id })
    .from(product)
    .where(eq(product.handle, localHandle(p.handle)))
  return byHandle?.id ?? null
}

const existingProduct = (ctx: ImportContext, p: NProduct) =>
  ctx.inStore((tx) => matchProduct(tx, p))

/**
 * Download every image, `IMAGE_CONCURRENCY` at a time; failures become issues
 * and the product imports without them.
 */
async function hostImages(ctx: ImportContext, p: NProduct): Promise<Map<string, string>> {
  const hosted = new Map<string, string>()
  await mapLimit(p.images, IMAGE_CONCURRENCY, async (image) => {
    try {
      const id = await ctx.media.host(image.src, image.alt)
      if (id) hosted.set(image.src, id)
    } catch (err) {
      ctx.report.issue({
        resource: 'products',
        row: p.row,
        ref: p.handle,
        sourceId: productSourceId(p),
        kind: 'media',
        message: `Image ${image.src} was not copied: ${errorMessage(err)}`,
      })
    }
  })
  return hosted
}

async function descriptionOf(ctx: ImportContext, p: NProduct) {
  const { doc, images } = htmlToRichText(p.bodyHtml)
  if (!doc || images.length === 0) return doc
  const urls = new Map<string, string>()
  await mapLimit(images, IMAGE_CONCURRENCY, async (image) => {
    try {
      const id = await ctx.media.host(image.src, image.alt || null)
      const url = id ? await ctx.media.urlOf(id) : null
      if (url) urls.set(image.src, url)
    } catch {
      // A missing body image keeps pointing at the source; not worth failing the product.
    }
  })
  replaceImageSources(doc, urls)
  return doc
}

function toWrite(
  p: NProduct,
  hosted: Map<string, string>,
  description: ProductWrite['description'],
  isNew: boolean,
): ProductWrite {
  const values = (i: number) =>
    [...new Set(p.variants.map((v) => v.optionValues[i] ?? ''))]
      .filter(Boolean)
      .map((value) => ({ value: value.slice(0, 100) }))
  return {
    title: p.title.slice(0, 200),
    handle: localHandle(p.handle),
    description,
    vendor: clip(p.vendor, 100),
    productType: clip(p.productType, 100),
    tags: p.tags.slice(0, 100).map((t) => t.slice(0, 50)),
    seoTitle: clip(p.seoTitle, 70),
    seoDescription: clip(p.seoDescription, 320),
    status: p.status,
    inventoryReason: 'correction',
    options: p.optionNames.map((name, i) => ({ name: name.slice(0, 50), values: values(i) })),
    variants: p.variants.map((v) => ({
      optionValues: v.optionValues.map((o) => o.slice(0, 100)),
      sku: clip(v.sku, 100),
      barcode: clip(v.barcode, 100),
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      costPaise: v.costPaise,
      taxable: v.taxable,
      trackInventory: v.trackInventory,
      weightGrams: v.weightGrams,
      hsCode: v.hsCode,
      mediaId: v.imageSrc ? (hosted.get(v.imageSrc) ?? null) : null,
      // Unknown stock: new variants start at zero, existing ones keep what they have.
      ...(v.onHand !== null ? { onHand: v.onHand } : isNew ? { onHand: 0 } : {}),
    })),
    mediaIds: p.images.flatMap((i) => {
      const id = hosted.get(i.src)
      return id ? [id] : []
    }),
  }
}

function preview(ctx: ImportContext, p: NProduct, existingId: string | null) {
  ctx.report.count('products', existingId ? 'updated' : 'created')
  ctx.report.sample({
    resource: 'products',
    key: p.handle,
    title: p.title,
    action: existingId ? 'update' : 'create',
    detail: `${p.variants.length} ${p.variants.length === 1 ? 'variant' : 'variants'}, ${p.images.length} ${p.images.length === 1 ? 'image' : 'images'}`,
  })
}

const failed = (ctx: ImportContext, p: NProduct, err: unknown) => {
  ctx.report.count('products', 'failed')
  ctx.report.issue({
    resource: 'products',
    row: p.row,
    ref: p.handle,
    sourceId: productSourceId(p),
    message: errorMessage(err),
  })
}

/** Images copied and the write built: everything before the database. */
async function prepare(ctx: ImportContext, p: NProduct, existingId: string | null) {
  const hosted = await hostImages(ctx, p)
  const description = (await descriptionOf(ctx, p)) as ProductWrite['description']
  return toWrite(p, hosted, description, !existingId)
}

/** The database part of one product, against the caller's transaction. */
async function applyProduct(
  tx: StoreTx,
  ctx: ImportContext,
  p: NProduct,
  write: ProductWrite,
  existingId: string | null,
  mappings?: MappingRow[],
): Promise<string> {
  const saved = existingId
    ? await updateProduct(tx, ctx.storeId, existingId, write)
    : await createProduct(tx, ctx.storeId, write)
  if (mappings) mappings.push({ sourceId: productSourceId(p), localId: saved })
  else await saveMapping(tx, ctx.storeId, 'products', productSourceId(p), saved)
  const [row] = await tx
    .select({ handle: product.handle })
    .from(product)
    .where(eq(product.id, saved))
  const final = row?.handle ?? localHandle(p.handle)
  if (final !== p.handle.toLowerCase()) {
    await upsertImportedRedirect(tx, ctx.storeId, `/products/${p.handle}`, `/products/${final}`)
  }
  return saved
}

async function commitOne(
  ctx: ImportContext,
  p: NProduct,
  write: ProductWrite,
  existingId: string | null,
): Promise<string | null> {
  try {
    const id = await ctx.inStore((tx) => applyProduct(tx, ctx, p, write, existingId))
    ctx.report.count('products', existingId ? 'updated' : 'created')
    return id
  } catch (err) {
    failed(ctx, p, err)
    return null
  }
}

/**
 * Create or update one product. Matches on the import mapping, then the handle,
 * so a second run updates in place. A handle we had to change gets a 301 from
 * the Shopify URL.
 */
export async function writeProduct(ctx: ImportContext, p: NProduct): Promise<string | null> {
  const existingId = await existingProduct(ctx, p)
  if (ctx.dryRun) {
    preview(ctx, p, existingId)
    return existingId
  }
  let write: ProductWrite
  try {
    write = await prepare(ctx, p, existingId)
  } catch (err) {
    failed(ctx, p, err)
    return null
  }
  return commitOne(ctx, p, write, existingId)
}

/** Images for this many products download at the same time (each up to `IMAGE_CONCURRENCY`). */
const PREPARE_CONCURRENCY = 3

/**
 * A batch of products: matched in one transaction; on an import their images
 * are copied first (outside any transaction), then every product is written in
 * one transaction with the mappings in one statement. A failure rolls the batch
 * back and commits them one at a time, reusing the copied images.
 */
export async function writeProducts(ctx: ImportContext, batch: readonly NProduct[]) {
  // How many images Shopify's products carry, on a preview and an import alike: the
  // status page compares it with what is here ("Product images: 2,097 not copied").
  const progress = ctx.report.of('products')
  progress.images = (progress.images ?? 0) + batch.reduce((n, p) => n + p.images.length, 0)
  let existing: (string | null)[] = []
  try {
    existing = await ctx.inStore(async (tx) => {
      const out: (string | null)[] = []
      for (const p of batch) out.push(await matchProduct(tx, p))
      return out
    })
  } catch {
    for (const p of batch) {
      await writeProduct(ctx, p)
      await ctx.report.flush()
    }
    return
  }
  if (ctx.dryRun) {
    batch.forEach((p, i) => {
      preview(ctx, p, existing[i] ?? null)
    })
    await ctx.report.flush()
    return
  }
  type Ready = { p: NProduct; write: ProductWrite; existingId: string | null }
  const prepared = await mapLimit(batch, PREPARE_CONCURRENCY, async (p, i) => {
    const existingId = existing[i] ?? null
    try {
      return { p, write: await prepare(ctx, p, existingId), existingId }
    } catch (err) {
      failed(ctx, p, err)
      return null
    }
  })
  const ready = prepared.filter((r): r is Ready => r !== null)
  await writeBatch(ctx, ready, {
    batch: async (tx, items) => {
      const mappings: MappingRow[] = []
      for (const r of items) await applyProduct(tx, ctx, r.p, r.write, r.existingId, mappings)
      await saveMappings(tx, ctx.storeId, 'products', mappings)
      return items.map((r): 'updated' | 'created' => (r.existingId ? 'updated' : 'created'))
    },
    report: (_r, outcome) => ctx.report.count('products', outcome),
    one: (r) => commitOne(ctx, r.p, r.write, r.existingId),
  })
}
