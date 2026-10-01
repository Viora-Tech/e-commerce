import { hasCopy, type MainProductAccordion } from '../sections/main-product-settings'
import RichCopy from './rich-copy'

type ProductAccordionsProps = {
  items: MainProductAccordion[]
}

// The `accordion` blocks of sections/main-product.liquid: native details/summary panels
// (keyboard, screen reader and in-page Find for free). A panel with no title or no content
// is left out, as in the theme. The theme could also fill a panel from a product metafield
// (specification, package contents, dimensions); we have no metafields yet, so the content
// is the merchant's text.
export default function ProductAccordions({ items }: ProductAccordionsProps) {
  // Early returns
  const shown = items.filter((a) => hasCopy(a.title) && hasCopy(a.body))
  if (shown.length === 0) return null

  return (
    <>
      {shown.map((a, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: titles may be editor nodes; the list is ordered settings.
        <details key={i} className="product-accordion">
          <summary className="product-accordion__summary">
            <span className="product-accordion__title">{a.title}</span>
            <span className="product-accordion__toggle" aria-hidden="true" />
          </summary>
          <RichCopy value={a.body} className="product-accordion__body rte" />
        </details>
      ))}
    </>
  )
}
