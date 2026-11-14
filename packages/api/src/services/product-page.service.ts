/** The product page's server reads: one product with its variants, options and images, and
 *  `products.getPage` (the product, the suggestions, Write with AI and the shipping boxes). */
import { type BoxPreset, loadProductVariantMedia, parseShippingSettings } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  media,
  product,
  productMedia,
  productOption,
  productOptionValue,
  sellableStock,
  store,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { productFacets } from './product.service'

/** One product as the product form edits it: variants with stock, options, images; null when missing. */
export async function getProduct(tx: StoreTx, id: string) {
  // Every read is keyed by the product id, so they go out together (one round trip on the
  // transaction's connection), not one after another.
  const [[p], variants, options, values, links, images, variantImages] = await Promise.all([
    tx.select().from(product).where(eq(product.id, id)),
    tx
      .select({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode,
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        costPaise: variant.costPaise,
        taxable: variant.taxable,
        trackInventory: variant.trackInventory,
        hiddenOnStore: variant.hiddenOnStore,
        preorderOverride: variant.preorderOverride,
        requiresShipping: variant.requiresShipping,
        weightGrams: variant.weightGrams,
        weightUnit: variant.weightUnit,
        hsCode: variant.hsCode,
        countryOfOrigin: variant.countryOfOrigin,
        gstRatePercent: variant.gstRatePercent,
        boxPresetId: variant.boxPresetId,
        packageLengthCm: variant.packageLengthCm,
        packageWidthCm: variant.packageWidthCm,
        packageHeightCm: variant.packageHeightCm,
        boxOwn: variant.boxOwn,
        mediaId: variant.mediaId,
        onHand: sellableStock.onHand,
        reserved: sellableStock.reserved,
      })
      .from(variant)
      .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
      .where(and(eq(variant.productId, id), isNull(variant.archivedAt)))
      .orderBy(asc(variant.position)),
    tx
      .select()
      .from(productOption)
      .where(eq(productOption.productId, id))
      .orderBy(asc(productOption.position)),
    tx
      .select({
        id: productOptionValue.id,
        optionId: productOptionValue.optionId,
        value: productOptionValue.value,
      })
      .from(productOptionValue)
      .innerJoin(productOption, eq(productOption.id, productOptionValue.optionId))
      .where(eq(productOption.productId, id))
      .orderBy(asc(productOptionValue.position)),
    tx
      .select({
        variantId: variantOptionValue.variantId,
        optionValueId: variantOptionValue.optionValueId,
      })
      .from(variantOptionValue)
      .innerJoin(variant, eq(variant.id, variantOptionValue.variantId))
      .where(eq(variant.productId, id)),
    tx
      .select({ id: media.id, url: media.url, alt: media.alt, contentType: media.contentType })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(eq(productMedia.productId, id))
      .orderBy(asc(productMedia.position)),
    loadProductVariantMedia(tx, id),
  ])
  if (!p) return null
  const valueById = new Map(values.map((v) => [v.id, v]))
  const valuesOfVariant = new Map<string, (typeof values)[number][]>()
  for (const l of links) {
    const val = valueById.get(l.optionValueId)
    if (val) valuesOfVariant.set(l.variantId, [...(valuesOfVariant.get(l.variantId) ?? []), val])
  }
  return {
    ...p,
    images,
    options: options.map((o) => ({
      id: o.id,
      name: o.name,
      values: values.filter((v) => v.optionId === o.id).map((v) => ({ id: v.id, value: v.value })),
    })),
    variants: variants.map(({ preorderOverride, ...v }) => ({
      ...v,
      /** The variant's "Allow pre-order" switch (on unless its override turns it off). */
      preorderAllowed: preorderOverride?.enabled !== false,
      /** The variant's own pre-order limit; null uses the product's (or campaign's) limit. */
      preorderLimit: preorderOverride?.limit ?? null,
      /** The variant's images in order; the first is `mediaId`. */
      mediaIds: variantImages.get(v.id) ?? (v.mediaId ? [v.mediaId] : []),
      /** Values in option order, so the form can rebuild the matrix row. */
      optionValues: options.map(
        (o) => valuesOfVariant.get(v.id)?.find((val) => val.optionId === o.id)?.value ?? '',
      ),
    })),
  }
}

/** The store's saved shipping boxes (Settings › Shipping), for the product page's Package select. */
async function storeBoxPresets(tx: StoreTx, storeId: string): Promise<BoxPreset[]> {
  const [row] = await tx
    .select({ shipping: store.shipping })
    .from(store)
    .where(eq(store.id, storeId))
  return parseShippingSettings(row?.shipping).boxPresets ?? []
}

/**
 * The product page's server render in one transaction: the product (null when missing, and for
 * "Add product" with no id), the store's suggestions (`productFacets`), whether "Write with AI"
 * shows (`ai.status`) and, for a member who may read settings, the shipping boxes the Shipping
 * tab offers (it used to read all of `store.getShipping` from the browser).
 */
export async function productPage(
  tx: StoreTx,
  storeId: string,
  id: string | undefined,
  opts: { boxPresets: boolean; aiWriter: () => Promise<boolean> },
) {
  const [loaded, facets, boxPresets, aiWriter] = await Promise.all([
    id ? getProduct(tx, id) : null,
    productFacets(tx, storeId),
    opts.boxPresets ? storeBoxPresets(tx, storeId) : ([] as BoxPreset[]),
    // AI is optional: any failure just hides the button.
    opts.aiWriter().catch(() => false),
  ])
  return { product: loaded, facets, boxPresets, aiWriter }
}
