'use client'

import { RichTextRenderer, richTextToPlainText } from '@commerce/richtext'
import { useState } from 'react'
import { mainProductContent as copy } from '../data/zero-drift/main-product'
import { descriptionDoc } from '../product-data'
import type { ProductDetail } from '../types'

type ProductDescriptionProps = {
  description: ProductDetail['description']
}

/** Past this many characters the description is clamped behind "Read more". */
const CLAMP_AT = 280

// The `description` block of sections/main-product.liquid: the product's own copy in the
// buy box, clamped with Read more / Show less when it runs long.
export default function ProductDescription({ description }: ProductDescriptionProps) {
  // Hooks
  const [expanded, setExpanded] = useState(false)

  // Early returns
  const doc = descriptionDoc(description)
  if (!doc) return null

  // Render logic
  const long = richTextToPlainText(doc).length > CLAMP_AT
  const clamped = long && !expanded

  return (
    <div
      className={`product-info__description text-body rte${clamped ? ' product-info__description--clamped' : ''}`}
    >
      <div className="product-info__description-body">
        <RichTextRenderer data={doc} />
      </div>
      {long ? (
        <button
          type="button"
          className="product-info__read-more"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? copy.ui.showLess : copy.ui.readMore}
        </button>
      ) : null}
    </div>
  )
}
