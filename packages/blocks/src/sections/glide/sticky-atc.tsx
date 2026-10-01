import type { ComponentConfig } from '@puckeditor/core'
import type { ReactNode } from 'react'
import ProductSectionHint from '../../components/sections/glide/product-section-hint'
import StickyAtc from '../../components/sticky-atc'
import { stickyAtcContent as copy } from '../../data/glide/sticky-atc'
import type { SectionMetadata } from '../dynamic'
import { inlineText } from '../inline-fields'

export type StickyAtcProps = {
  placement: 'corner' | 'bar'
  /** Inline copy: a string, or Puck's inline editor node on the canvas. */
  addLabel: ReactNode
  soldOutLabel: ReactNode
}

/**
 * sections/sticky-atc.liquid. No section frame: the bar is fixed to the viewport, so a
 * padded band around it would only leave a gap in the page. It needs the product being
 * viewed (`SectionMetadata.product`) and renders nothing without one (a hint in the editor); on the storefront the
 * product route binds `productActions.addToCart`, in Customize the button stays inert.
 */
export function stickyAtcSection(): ComponentConfig {
  return {
    label: copy.label,
    fields: {
      placement: { type: 'select', label: copy.placementLabel, options: copy.placements },
      addLabel: inlineText(copy.addLabelField),
      soldOutLabel: inlineText(copy.soldOutLabelField),
    },
    defaultProps: { ...copy.defaults },
    render: ({ puck, placement, addLabel, soldOutLabel }) => {
      const meta = (puck?.metadata ?? {}) as SectionMetadata
      // Like the other product sections: nothing on the storefront, a hint in the editor.
      if (!meta.product)
        return puck?.isEditing ? <ProductSectionHint text={copy.noProduct} /> : null
      return (
        <StickyAtc
          product={meta.product}
          placement={placement === 'bar' ? 'bar' : 'corner'}
          addLabel={addLabel ?? copy.defaults.addLabel}
          soldOutLabel={soldOutLabel ?? copy.defaults.soldOutLabel}
          onAddToCart={meta.productActions?.addToCart}
          preview={puck?.isEditing === true}
        />
      )
    },
  } as ComponentConfig
}
