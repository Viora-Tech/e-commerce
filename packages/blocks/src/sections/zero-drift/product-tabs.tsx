import type { ReactNode } from 'react'
import RichCopy from '../../components/rich-copy'
import ProductDoc from '../../components/sections/zero-drift/product-doc'
import ProductTabs, { type ProductTabItem } from '../../components/sections/zero-drift/product-tabs'
import SpecRowsTable from '../../components/sections/zero-drift/spec-rows-table'
import { productTabsContent as copy } from '../../data/zero-drift/product-tabs'
import { descriptionDoc, specRows } from '../../product-data'
import { richtextHtml } from '../../richtext-html'
import { defaultSectionSettings } from '../../section-settings'
import type { ProductDetail } from '../../types'
import type { Frame } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import { productFramed } from './product-frame'

type TabContent = 'description' | 'text' | 'specs'

type Tab = {
  label: string
  content: TabContent
  /** Rich text, for `text` tabs. */
  body: string
  /** `Label: value` lines (connectable to a multi-line metafield), for `specs` tabs. */
  rows: string
  anchor: string
  preselected: boolean
}

export type ProductTabsProps = Frame & { layout: 'tabs' | 'stacked'; tabs: Tab[] }

const defaults = {
  layout: 'tabs' as const,
  tabs: copy.tabs.map((t) => ({ ...t, content: t.content as TabContent })),
}

/** The tab's `#hash`: its anchor, else its label, handle-ised as the theme does. */
const tabKey = (tab: Tab, index: number) => {
  const raw = typeof tab.anchor === 'string' && tab.anchor ? tab.anchor : tab.label
  const key =
    typeof raw === 'string'
      ? raw
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : ''
  return key || `tab-${index + 1}`
}

/**
 * A tab's panel, or null when it has nothing on this product: the theme drops a tab whose
 * content renders empty (no description, no rows), so a shopper never opens a blank panel.
 */
function panelFor(tab: Tab, product: ProductDetail): ReactNode | null {
  if (tab.content === 'description') {
    const doc = descriptionDoc(product.description)
    return doc ? <ProductDoc doc={doc} /> : null
  }
  if (tab.content === 'specs') {
    const rows = specRows(tab.rows)
    return rows.length ? <SpecRowsTable rows={rows} /> : null
  }
  // On the canvas the body is Puck's inline editor (a node); on the storefront, stored HTML.
  if (typeof tab.body === 'string' && !richtextHtml(tab.body)) return null
  return <RichCopy value={tab.body} className="product-tabs__prose rte" />
}

export function productTabsSection() {
  return productFramed<ProductTabsProps>(
    copy.label,
    {
      layout: { type: 'radio', label: copy.fields.layout, options: copy.layouts },
      tabs: {
        type: 'array',
        label: copy.fields.tabs,
        getItemSummary: (t: { label?: unknown }) =>
          (typeof t.label === 'string' && t.label) || copy.untitled,
        defaultItemProps: { ...copy.newTab },
        arrayFields: {
          label: inlineText(copy.fields.label),
          content: { type: 'select', label: copy.fields.content, options: copy.contents },
          body: inlineRichtext(copy.fields.body),
          rows: { type: 'textarea', label: copy.fields.rows },
          anchor: { type: 'text', label: copy.fields.anchor },
          preselected: { type: 'radio', label: copy.fields.preselected, options: copy.yesNo },
        },
      },
    },
    defaults,
    copy,
    (p, product, id) => {
      const seen = new Set<string>()
      const items = (p.tabs ?? []).flatMap((tab, i): ProductTabItem[] => {
        const panel = panelFor(tab, product)
        if (panel === null) return []
        // Two tabs with the same label still need their own panel ids.
        const key = seen.has(tabKey(tab, i)) ? `${tabKey(tab, i)}-${i + 1}` : tabKey(tab, i)
        seen.add(key)
        const label = tab.label || copy.untitled
        return [{ key, label, panel, preselected: tab.preselected === true }]
      })
      if (items.length === 0) return null
      return (
        <div className="section-product-tabs">
          <ProductTabs
            id={id}
            layout={p.layout === 'stacked' ? 'stacked' : 'tabs'}
            ariaLabel={copy.ariaLabel}
            items={items}
          />
        </div>
      )
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 40 }),
      },
    },
  )
}
