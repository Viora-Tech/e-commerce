import type { ProductDetail } from '@commerce/blocks'
import type { TemplateKey } from '@commerce/core/theme'
import { api } from '@/lib/api-client'
import { catalogCards } from './customize-config'
import type { PreviewResource } from './customize-preview'

/** Templates that preview with a chosen resource, and the resource they need. */
export const RESOURCE_KINDS = ['product', 'collection', 'page'] as const
export type ResourceKind = (typeof RESOURCE_KINDS)[number]

export const resourceKindOf = (key: TemplateKey): ResourceKind | null =>
  (RESOURCE_KINDS as readonly string[]).includes(key) ? (key as ResourceKind) : null

export type ResourceOption = { id: string; title: string }

/** What the resource picker offers for a template kind. */
export async function listResources(kind: ResourceKind): Promise<ResourceOption[]> {
  if (kind === 'product') {
    const r = await api.products.list({ page: 1, perPage: 100, status: 'active' })
    return r.items.map((p) => ({ id: p.id, title: p.title }))
  }
  if (kind === 'collection') {
    return (await api.collections.list()).map((c) => ({ id: c.id, title: c.title }))
  }
  return (await api.pages.list()).map((p) => ({ id: p.id, title: p.title }))
}

type AdminProduct = NonNullable<Awaited<ReturnType<typeof api.products.get>>>

/** The admin product as the storefront's product view reads it. */
function toProductDetail(p: AdminProduct): ProductDetail {
  const valueIds = new Map(
    p.options.flatMap((o) => o.values.map((v) => [`${o.name}:${v.value}`, v.id] as const)),
  )
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description as ProductDetail['description'],
    vendor: p.vendor,
    productType: p.productType,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt, contentType: i.contentType })),
    options: p.options,
    variants: p.variants.map((v) => {
      const available = v.trackInventory ? Math.max(0, (v.onHand ?? 0) - (v.reserved ?? 0)) : 999
      return {
        id: v.id,
        title: v.title,
        sku: v.sku,
        pricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise,
        available,
        // Preview only: a real oversell-beyond-stock check needs the reserved/on_hand
        // pair from inventory_level, which this admin preview doesn't track separately.
        purchasable: available > 0 || p.preorderEnabled,
        optionValueIds: p.options.flatMap((o, i) => {
          const id = valueIds.get(`${o.name}:${v.optionValues[i]}`)
          return id ? [id] : []
        }),
        imageUrl: p.images.find((i) => i.id === v.mediaId)?.url ?? null,
        imageUrls: v.mediaIds.flatMap((id) => p.images.find((i) => i.id === id)?.url ?? []),
      }
    }),
    launchAt: p.launchAt ? new Date(p.launchAt).toISOString() : null,
    preorder: p.preorderEnabled
      ? { enabled: true, buttonLabel: p.preorderButtonLabel, shipDate: null, depositPreview: null }
      : null,
  }
}

/** Loads the chosen resource for the preview's main section. */
export async function loadResource(kind: ResourceKind, id: string): Promise<PreviewResource> {
  if (kind === 'product') {
    const p = await api.products.get({ id })
    return p ? { kind, product: toProductDetail(p) } : null
  }
  if (kind === 'collection') {
    const c = await api.collections.get({ id })
    if (!c) return null
    const rows = await api.collections.products({ collectionId: id, perPage: 24 })
    const cards = await catalogCards()
    return {
      kind,
      title: c.title,
      cards: rows.items.flatMap((r) => cards.filter((card) => card.handle === r.handle)),
    }
  }
  const page = await api.pages.get({ id })
  return page ? { kind, title: page.title, body: page.body } : null
}
