import { type CardProduct, createBlocksConfig } from '@commerce/blocks/puck'
import { GROUP_SECTIONS, SINGLE_SECTIONS } from '@commerce/core/theme'
import { RichTextEditor } from '@commerce/editor'
import { type ComponentConfig, type Config, DropZone } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { api } from '@/lib/api-client'

type ListedProduct = Awaited<ReturnType<typeof api.products.list>>['items'][number]

const toCard = (p: ListedProduct): CardProduct => ({
  id: p.id,
  handle: p.handle,
  title: p.title,
  vendor: p.vendor,
  productType: p.productType,
  pricePaise: p.minPricePaise ?? 0,
  mrpPaise: null,
  available: p.available,
  images: p.imageUrl ? [{ url: p.imageUrl, alt: p.title }] : [],
})

let catalog: Promise<CardProduct[]> | null = null

/** Active products as cards, fetched once per editor session; every product block reads from it. */
export function catalogCards(): Promise<CardProduct[]> {
  catalog ??= api.products
    .list({ page: 1, perPage: 100, status: 'active' })
    .then((r) => r.items.map(toCard))
    .catch(() => {
      catalog = null
      return []
    })
  return catalog
}

async function collectionCards(handle: string, limit: number): Promise<CardProduct[]> {
  const collections = await api.collections.list()
  const found = collections.find((c) => c.handle === handle)
  if (!found) return []
  const rows = await api.collections.products({ collectionId: found.id, perPage: limit })
  const cards = await catalogCards()
  return rows.items.flatMap((r) => cards.filter((c) => c.handle === r.handle))
}

type Render = (props: Record<string, unknown>) => ReactNode

/**
 * A hidden section stays in the tree (Shopify's eye toggle) but draws nothing
 * in the preview, as on the storefront.
 */
function withHiding(component: ComponentConfig): ComponentConfig {
  const render = component.render as unknown as Render
  const hidden: Render = (props) => (props._hidden === true ? null : render(props))
  return { ...component, render: hidden as unknown as ComponentConfig['render'] }
}

/**
 * The Puck config behind Customize. Blocks load their data through the admin API;
 * the root draws the header and footer groups as drop zones around the template.
 */
export function createCustomizeConfig(): Config {
  const base = createBlocksConfig(
    async ({ productType, collectionHandle, limit }) => {
      if (collectionHandle) return collectionCards(collectionHandle, limit)
      const cards = await catalogCards()
      return (productType ? cards.filter((c) => c.productType === productType) : cards).slice(
        0,
        limit,
      )
    },
    {
      RichTextEditor,
      loadArticles: (query) => api.blog.recent(query),
      loadCollections: async (handles) => {
        const all = await api.collections.list()
        return handles.flatMap((h) =>
          all
            .filter((c) => c.handle === h)
            .map((c) => ({
              handle: c.handle,
              title: c.title,
              imageUrl: c.imageUrl,
              productCount: c.productCount,
            })),
        )
      },
      loadProduct: async (handle) =>
        (await catalogCards()).find((c) => c.handle === handle) ?? null,
    },
  ) as unknown as Config

  const components = Object.fromEntries(
    Object.entries(base.components).map(([type, component]) => {
      const wrapped = withHiding(component as ComponentConfig)
      return [
        type,
        SINGLE_SECTIONS.has(type)
          ? { ...wrapped, permissions: { delete: false, duplicate: false } }
          : wrapped,
      ]
    }),
  )

  return {
    ...base,
    components,
    root: {
      render: ({ children }: { children: ReactNode }) => (
        <>
          <DropZone zone="header" allow={[...GROUP_SECTIONS.header]} />
          {children}
          <DropZone zone="footer" allow={[...GROUP_SECTIONS.footer]} />
        </>
      ),
    },
  }
}
