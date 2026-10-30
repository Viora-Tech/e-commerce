/**
 * The theme editor AI's `findImages` lookup: the store's own products and collections whose
 * name matches, each with its main picture and its storefront link, so the AI can fill an image
 * setting and a button link with real values instead of sending the merchant to do it by hand.
 * Read only, inside the caller's `withStore` transaction (the store's rows only).
 */
import { notSystemTest } from '@commerce/core'
import { collection, media, product, productMedia, type StoreTx } from '@commerce/db'
import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm'

export type FoundImage = {
  kind: 'product' | 'collection'
  title: string
  /** The storefront link: `/products/<handle>` or `/collections/<handle>`. */
  link: string
  /** The main picture's URL, or null when it has none. */
  imageUrl: string | null
  alt: string | null
}

/** Most results one lookup returns, products and collections together. */
export const MAX_FOUND_IMAGES = 10

/** `%` and `_` typed by the model match literally. */
const likeText = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** The whole phrase, or else any of its words of 3+ letters ("glass mousepad" → glass, mousepad). */
export function searchTerms(query: string): string[] {
  const phrase = query.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!phrase) return []
  const words = phrase.split(' ').filter((w) => w.length >= 3)
  return [phrase, ...words.filter((w) => w.toLowerCase() !== phrase.toLowerCase())].slice(0, 5)
}

async function productHits(tx: StoreTx, terms: string[], limit: number): Promise<FoundImage[]> {
  const rows = await tx
    .select({ id: product.id, title: product.title, handle: product.handle })
    .from(product)
    .where(and(notSystemTest, or(...terms.map((t) => ilike(product.title, likeText(t))))))
    .limit(limit)
  if (!rows.length) return []
  const pictures = await tx
    .select({ productId: productMedia.productId, url: media.url, alt: media.alt })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(
      inArray(
        productMedia.productId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(productMedia.position))
  return rows.map((r) => {
    const first = pictures.find((p) => p.productId === r.id)
    return {
      kind: 'product',
      title: r.title,
      link: `/products/${r.handle}`,
      imageUrl: first?.url ?? null,
      alt: first?.alt ?? null,
    }
  })
}

async function collectionHits(tx: StoreTx, terms: string[], limit: number): Promise<FoundImage[]> {
  const rows = await tx
    .select({
      title: collection.title,
      handle: collection.handle,
      url: media.url,
      alt: media.alt,
    })
    .from(collection)
    .leftJoin(media, eq(media.id, collection.imageMediaId))
    .where(or(...terms.map((t) => ilike(collection.title, likeText(t)))))
    .limit(limit)
  return rows.map((r) => ({
    kind: 'collection',
    title: r.title,
    link: `/collections/${r.handle}`,
    imageUrl: r.url ?? null,
    alt: r.alt ?? null,
  }))
}

/** Products first (a named product is the usual ask), then collections, at most MAX_FOUND_IMAGES. */
export async function findImages(tx: StoreTx, query: string): Promise<FoundImage[]> {
  const terms = searchTerms(query)
  if (!terms.length) return []
  const products = await productHits(tx, terms, MAX_FOUND_IMAGES)
  const collections = await collectionHits(tx, terms, MAX_FOUND_IMAGES - products.length || 1)
  return [...products, ...collections].slice(0, MAX_FOUND_IMAGES)
}
