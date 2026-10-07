import type { ComponentConfig } from '@puckeditor/core'
import type { ReactNode } from 'react'
import SectionFrame from '../../components/section-frame'
import ProductSectionHint from '../../components/sections/glide/product-section-hint'
import { type LegacySectionProps, migrateSectionSettings } from '../../section-settings'
import type { ProductDetail } from '../../types'
import type { SectionMetadata } from '../dynamic'
import { type Frame, framed } from '../framed'

type Hints = {
  /** Shown in the editor on a template with no product (home, a page...). */
  noProduct: string
  /** Shown in the editor when the product has nothing for this section yet. */
  empty: string
}

/**
 * A Zero Drift product-page section: `framed()` fields and defaults, drawn only when the
 * template has a product (`SectionMetadata.product`). `body` returns null when this
 * product has nothing to show (no rows typed or connected); the storefront then renders
 * nothing at all, not an empty padded band, and the editor shows a plain hint instead,
 * like the theme's `request.design_mode` branch.
 */
export function productFramed<P extends Frame>(
  label: string,
  fields: Record<string, unknown>,
  defaults: Omit<P, keyof Frame>,
  hints: Hints,
  /**
   * `id` is the section's Puck id, for element ids that must be unique on the page; `meta` is
   * the page's metadata, for a section an app fills (`appBlockContext`).
   */
  body: (props: P, product: ProductDetail, id: string, meta: SectionMetadata) => ReactNode | null,
  extra: { defaultProps?: P } = {},
): ComponentConfig {
  const base = framed<P>(label, fields, defaults, () => null, extra)
  return {
    ...base,
    render: ({ puck, ...props }) => {
      const p = props as unknown as P
      const meta = (puck?.metadata ?? {}) as SectionMetadata
      const editing = puck?.isEditing === true
      const id = typeof props.id === 'string' ? props.id : label.toLowerCase().replace(/\W+/g, '-')
      const content = meta.product ? body(p, meta.product, id, meta) : null
      const hint = meta.product ? hints.empty : hints.noProduct
      if (content === null && !editing) return null
      return (
        <SectionFrame settings={migrateSectionSettings(p as unknown as LegacySectionProps)}>
          {content ?? <ProductSectionHint text={hint} />}
        </SectionFrame>
      )
    },
  } as ComponentConfig
}
