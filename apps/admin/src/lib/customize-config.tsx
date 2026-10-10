import { type AppBlockOwner, type CardProduct, createBlocksConfig } from '@commerce/blocks/puck'
import { applyBindings, isBinding } from '@commerce/core/dynamic-sources'
import { GROUP_SECTIONS, SINGLE_SECTIONS } from '@commerce/core/theme'
import { type ComponentConfig, type Config, DropZone } from '@puckeditor/core'
import Image from '@tiptap/extension-image'
import type { ReactNode } from 'react'
import DynamicSourceSection from '@/components/themes/customize/dynamic-source-section'
import { api } from '@/lib/api-client'
import { APP_BLOCK_SOURCES } from '../../../../commerce.blocks.config'

/**
 * Pictures in long-form copy (Rich text, Text): Puck's Tiptap has no image node, so without
 * this an image converted from old Lexical copy would vanish on the next edit. Inline, so it
 * sits in its paragraph the way `lexicalToHtml` writes it; data: URLs are refused.
 */
const RICHTEXT_EXTENSIONS = [Image.configure({ inline: true, allowBase64: false })]

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
 * in the preview, as on the storefront. A shown one draws with its connected
 * settings (dynamic sources) filled from the previewed product or collection.
 */
function withHiding(component: ComponentConfig): ComponentConfig {
  const render = component.render as unknown as Render
  const hidden: Render = (props) =>
    props._hidden === true ? null : <DynamicSourceSection render={render} props={props} />
  return {
    ...component,
    render: hidden as unknown as ComponentConfig['render'],
    ...(component.resolveData ? { resolveData: withFallbacks(component.resolveData) } : {}),
  }
}

type ResolveData = NonNullable<ComponentConfig['resolveData']>

/**
 * Blocks' `resolveData` (product rows, collection lists) reads plain settings, so
 * it gets the typed-in fallbacks instead of bindings. A connected setting it
 * hands back unchanged is restored, so resolving never disconnects anything.
 */
function withFallbacks(resolveData: ResolveData): ResolveData {
  return async (data, params) => {
    const props = data.props as Record<string, unknown>
    const plain = applyBindings(props)
    const out = await resolveData({ ...data, props: plain } as typeof data, params)
    const next = { ...(out.props ?? {}) } as Record<string, unknown>
    for (const [key, value] of Object.entries(props)) {
      const connected = isBinding(value) || JSON.stringify(value)?.includes('"$source"')
      if (connected && key in next && JSON.stringify(next[key]) === JSON.stringify(plain[key])) {
        next[key] = value
      }
    }
    return { ...out, props: next as typeof out.props }
  }
}

/**
 * The Puck config behind Customize. Blocks load their data through the admin API;
 * the root draws the header and footer groups as drop zones around the template.
 * `enabledAppIds` (from `api.apps.list()`) gates `categories.apps` and the Add
 * panel's owner grouping the same way the storefront gates them per store; see
 * `commerce.blocks.config.ts` for why the editor cannot import the real plugin
 * manifests directly.
 */
export function createCustomizeConfig(
  enabledAppIds: ReadonlySet<string> = new Set(),
): Config & { appBlockOwners: Record<string, AppBlockOwner> } {
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
      richtextExtensions: RICHTEXT_EXTENSIONS,
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
    APP_BLOCK_SOURCES,
    enabledAppIds,
  ) as unknown as Config & { appBlockOwners: Record<string, AppBlockOwner> }

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
