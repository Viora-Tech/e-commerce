// Port of sections/tabbed-products.liquid: Puck config for the tabbed product grid (key `ProductGrid`)
import type { ComponentConfig } from '@puckeditor/core'
import TabbedProducts from '../../components/product-grid'
import { tabbedProductsContent as copy } from '../../data/zero-drift/tabbed-products'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed } from '../framed'
import { inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

/**
 * One tab as stored. Glide binds a tab to a collection; tabs saved before the refresh hold
 * `{ label, productType, limit }` (a product type, blank = every product) and keep working.
 */
export type ProductGridTab = {
  label: string
  collection?: string | undefined
  productType?: string | undefined
  limit?: number | undefined
}

export type ProductGridProps = Frame & {
  heading: string
  headingAlignment: 'left' | 'center'
  showTabCounts: boolean
  headingFollowsTab: boolean
  columns: number
  rows: number
  tabs: ProductGridTab[]
  /** Filled by resolveData; not edited directly. */
  resolved?: { label: string; products: CardProduct[]; href?: string; count?: number }[]
}

const f = copy.fields

const yesNo = [
  { label: f.yes, value: true },
  { label: f.no, value: false },
]

const defaults: Omit<ProductGridProps, keyof Frame> = {
  heading: copy.heading,
  headingAlignment: 'center',
  showTabCounts: false,
  headingFollowsTab: true,
  columns: 4,
  rows: 2,
  tabs: [{ label: copy.allTab, collection: '' }],
}

export function tabbedProductsSection(loaders: ZeroDriftLoaders): ComponentConfig {
  return framed<ProductGridProps>(
    copy.label,
    {
      heading: inlineText(f.heading),
      tabs: {
        type: 'array',
        label: f.tabs,
        max: 6,
        getItemSummary: (t: ProductGridTab) => t.label || t.collection || f.tab,
        defaultItemProps: { label: '', collection: '' },
        arrayFields: {
          collection: { type: 'text', label: f.collection },
          label: { type: 'text', label: f.label },
          productType: { type: 'text', label: f.productType },
          limit: { type: 'number', label: f.limit, min: 1, max: 24 },
        },
      },
      headingAlignment: {
        type: 'radio',
        label: f.headingAlignment,
        options: [
          { label: f.left, value: 'left' },
          { label: f.center, value: 'center' },
        ],
      },
      showTabCounts: { type: 'radio', label: f.showTabCounts, options: yesNo },
      headingFollowsTab: { type: 'radio', label: f.headingFollowsTab, options: yesNo },
      columns: { type: 'number', label: f.columns, min: 2, max: 5 },
      rows: { type: 'number', label: f.rows, min: 1, max: 4 },
    },
    defaults,
    (p) => (
      <TabbedProducts
        heading={p.heading}
        columns={p.columns}
        align={p.headingAlignment}
        showCounts={p.showTabCounts}
        headingFollowsTab={p.headingFollowsTab}
        tabs={p.resolved ?? []}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
        ...defaults,
      },
      resolveData: async ({ props }) => {
        const tabs = props.tabs ?? []
        const handles = tabs.map((t) => t.collection ?? '').filter(Boolean)
        const collections =
          handles.length > 0 && loaders.loadCollections
            ? await loaders.loadCollections(handles)
            : []
        const perTab = (props.columns || 4) * (props.rows || 2)
        const resolved = await Promise.all(
          tabs.map(async (t) => {
            const collection = t.collection
              ? collections.find((c) => c.handle === t.collection)
              : undefined
            const products = await loaders.loadProducts({
              ...(t.collection
                ? { collectionHandle: t.collection }
                : { productType: t.productType || undefined }),
              limit: t.limit ?? perTab,
            })
            return {
              label: t.label || collection?.title || t.collection || copy.allTab,
              products,
              href: t.collection ? `/collections/${t.collection}` : copy.allHref,
              ...(collection ? { count: collection.productCount } : {}),
            }
          }),
        )
        return { props: { resolved }, readOnly: { resolved: true } }
      },
    },
  )
}
