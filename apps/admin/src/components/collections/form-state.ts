import {
  type CollectionKind,
  type CollectionRules,
  type CollectionSort,
  type CollectionStatus,
  type CollectionWrite,
  emptyCollectionRules,
} from '@commerce/core/collections'
import type { PickedProduct } from './collection-products-picker'

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
  status: CollectionStatus
  products: { id: string; title: string; imageUrl: string | null }[]
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
    status: c.status,
    products: c.products.map((p) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl })),
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
    status: form.status,
    productIds: form.kind === 'manual' ? form.products.map((p) => p.id) : undefined,
  }
}
