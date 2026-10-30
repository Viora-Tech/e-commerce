import {
  type CollectionKind,
  type CollectionRules,
  type CollectionSort,
  type CollectionStatus,
  type CollectionWrite,
  emptyCollectionRules,
} from '@commerce/core/collections'

/** A product in a manual collection, with what the products table shows. */
export type PickedProduct = {
  id: string
  title: string
  imageUrl: string | null
  status: 'draft' | 'active' | 'archived'
  available: number
  pricePaiseMin: number | null
  pricePaiseMax: number | null
}

/** What `collections.get` returns, narrowed to what the form reads. */
export type LoadedCollection = {
  id: string
  title: string
  handle: string
  description: unknown
  imageMediaId: string | null
  imageUrl: string | null
  kind: CollectionKind
  rules: CollectionRules
  sortOrder: CollectionSort
  seoTitle: string | null
  seoDescription: string | null
  templateSuffix: string | null
  status: CollectionStatus
  updatedAt?: Date | string
  products: PickedProduct[]
}

export type CollectionFormState = {
  title: string
  description: unknown
  imageMediaId: string | null
  imageUrl: string | null
  kind: CollectionKind
  rules: CollectionRules
  sortOrder: CollectionSort
  seoTitle: string
  seoDescription: string
  /** Alternate collection template; blank is the default. */
  templateSuffix: string
  status: CollectionStatus
  products: PickedProduct[]
}

export function emptyCollectionForm(): CollectionFormState {
  return {
    title: '',
    description: null,
    imageMediaId: null,
    imageUrl: null,
    kind: 'manual',
    rules: emptyCollectionRules(),
    sortOrder: 'manual',
    seoTitle: '',
    seoDescription: '',
    templateSuffix: '',
    status: 'active',
    products: [],
  }
}

export function fromCollection(c: LoadedCollection): CollectionFormState {
  return {
    title: c.title,
    description: c.description,
    imageMediaId: c.imageMediaId,
    imageUrl: c.imageUrl,
    kind: c.kind,
    rules: c.rules ?? emptyCollectionRules(),
    sortOrder: c.sortOrder,
    seoTitle: c.seoTitle ?? '',
    seoDescription: c.seoDescription ?? '',
    templateSuffix: c.templateSuffix ?? '',
    status: c.status,
    products: c.products,
  }
}

export function toWrite(form: CollectionFormState): CollectionWrite {
  return {
    title: form.title.trim(),
    description: (form.description ?? null) as CollectionWrite['description'],
    imageMediaId: form.imageMediaId,
    kind: form.kind,
    rules: form.rules,
    sortOrder: form.sortOrder,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    templateSuffix: form.templateSuffix || null,
    status: form.status,
    productIds: form.kind === 'manual' ? form.products.map((p) => p.id) : undefined,
  }
}

/**
 * `products` with `id` moved to `position` (1 is first), the rest keeping their order. A position
 * past either end is clamped. Lets a product cross pages, which dragging cannot (audit #67).
 */
export function moveToPosition<T extends { id: string }>(
  products: T[],
  id: string,
  position: number,
): T[] {
  const from = products.findIndex((p) => p.id === id)
  if (from === -1) return products
  const item = products[from] as T
  const rest = products.filter((p) => p.id !== id)
  const to = Math.min(Math.max(Math.round(position) - 1, 0), rest.length)
  return [...rest.slice(0, to), item, ...rest.slice(to)]
}
