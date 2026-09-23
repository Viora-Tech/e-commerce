import {
  createProduct,
  type ProductWrite,
  slugify,
  updateProduct,
  upsertImportedRedirect,
} from '@commerce/core'
import { product } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { htmlToRichText, replaceImageSources } from './html'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { NProduct } from './types'

const clip = (value: string | null, max: number) => (value ? value.slice(0, max) : null)

/** Our handle for a source handle: Shopify allows characters ours do not. */
export function localHandle(handle: string): string {
  return slugify(handle) || 'product'
}

/** The mapping key: the Shopify id when known, else the handle (CSV exports carry no ids). */
export const productSourceId = (p: Pick<NProduct, 'sourceId' | 'handle'>) =>
  p.sourceId ?? `handle:${p.handle.toLowerCase()}`

async function existingProduct(ctx: ImportContext, p: NProduct): Promise<string | null> {
  return ctx.inStore(async (tx) => {
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
  })
}

/** Download every image once; failures become issues and the product imports without them. */
async function hostImages(ctx: ImportContext, p: NProduct): Promise<Map<string, string>> {
  const hosted = new Map<string, string>()
  for (const image of p.images) {
    try {
      const id = await ctx.media.host(image.src, image.alt)
      if (id) hosted.set(image.src, id)
    } catch (err) {
      ctx.report.issue({
        resource: 'products',
        row: p.row,
        ref: p.handle,
        message: `Image ${image.src} was not copied: ${errorMessage(err)}`,
      })
    }
  }
  return hosted
}

async function descriptionOf(ctx: ImportContext, p: NProduct) {
  const { doc, images } = htmlToRichText(p.bodyHtml)
  if (!doc || images.length === 0) return doc
  const urls = new Map<string, string>()
  for (const image of images) {
    try {
      const id = await ctx.media.host(image.src, image.alt || null)
      const url = id ? await ctx.media.urlOf(id) : null
      if (url) urls.set(image.src, url)
    } catch {
      // A missing body image keeps pointing at the source; not worth failing the product.
    }
  }
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

/**
 * Create or update one product. Matches on the import mapping, then the handle,
 * so a second run updates in place. A handle we had to change gets a 301 from
 * the Shopify URL.
 */
export async function writeProduct(ctx: ImportContext, p: NProduct): Promise<string | null> {
  const existingId = await existingProduct(ctx, p)
  const handle = localHandle(p.handle)
  if (ctx.dryRun) {
    ctx.report.count('products', existingId ? 'updated' : 'created')
    ctx.report.sample({
      resource: 'products',
      key: p.handle,
      title: p.title,
      action: existingId ? 'update' : 'create',
      detail: `${p.variants.length} ${p.variants.length === 1 ? 'variant' : 'variants'}, ${p.images.length} ${p.images.length === 1 ? 'image' : 'images'}`,
    })
    return existingId
  }
  try {
    const hosted = await hostImages(ctx, p)
    const description = (await descriptionOf(ctx, p)) as ProductWrite['description']
    const write = toWrite(p, hosted, description, !existingId)
    const id = await ctx.inStore(async (tx) => {
      const saved = existingId
        ? await updateProduct(tx, ctx.storeId, existingId, write)
        : await createProduct(tx, ctx.storeId, write)
      await saveMapping(tx, ctx.storeId, 'products', productSourceId(p), saved)
      const [row] = await tx
        .select({ handle: product.handle })
        .from(product)
        .where(eq(product.id, saved))
      const final = row?.handle ?? handle
      if (final !== p.handle.toLowerCase()) {
        await upsertImportedRedirect(tx, ctx.storeId, `/products/${p.handle}`, `/products/${final}`)
      }
      return saved
    })
    ctx.report.count('products', existingId ? 'updated' : 'created')
    return id
  } catch (err) {
    ctx.report.count('products', 'failed')
    ctx.report.issue({
      resource: 'products',
      row: p.row,
      ref: p.handle,
      message: errorMessage(err),
    })
    return null
  }
}
