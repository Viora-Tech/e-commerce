import { type SpecRow, specRows, specTable } from '../product-specs'
import { hasCopy, type MainProductAccordion } from '../sections/main-product-settings'
import type { ProductFieldText } from '../types'
import RichCopy from './rich-copy'

type ProductAccordionsProps = {
  items: MainProductAccordion[]
  /** The product's own fields; a panel with a `metafieldKey` the product has shows that field. */
  fields?: Record<string, ProductFieldText> | undefined
  /** `field key | Label` lines for a Specification panel with no written spec. */
  specTableRows?: string | undefined
}

/** Dimensions and weight have their own panel and spec cell; the sheet leaves them out. */
const SHEET_OMITS = ['dimensions', 'weight']

/**
 * What one panel holds, the theme's order: a written "Label: Value" spec as rows, else the
 * structured spec sheet (Specification only), else the product's field, else the
 * merchant's text.
 */
function panelBody(
  a: MainProductAccordion,
  fields: ProductAccordionsProps['fields'],
  tableRows: string,
): { rows: SpecRow[] } | { html: MainProductAccordion['body'] } | null {
  const field = a.metafieldKey ? fields?.[a.metafieldKey] : undefined
  if (a.metafieldKey === 'specification') {
    if (field?.text.includes(':')) return { rows: specRows(field.text) }
    const sheet = specTable(fields, tableRows, SHEET_OMITS)
    if (sheet.length > 0) return { rows: sheet }
  }
  if (field) return { html: field.html }
  return hasCopy(a.body) ? { html: a.body } : null
}

// The `accordion` blocks of sections/main-product.liquid: native details/summary panels
// (keyboard, screen reader and in-page Find for free). A panel with no title or nothing
// to hold is left out, as in the theme.
export default function ProductAccordions({
  items,
  fields,
  specTableRows = '',
}: ProductAccordionsProps) {
  // Early returns
  const shown = items.flatMap((a) => {
    const body = hasCopy(a.title) ? panelBody(a, fields, specTableRows) : null
    return body ? [{ title: a.title, body }] : []
  })
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
          {'rows' in a.body ? (
            <div className="product-accordion__body rte">
              <dl className="spec-table__list spec-table__list--rows">
                {a.body.rows.map((r) => (
                  <div key={`${r.label}|${r.value}`} className="spec-table__row">
                    {r.label ? <dt className="spec-table__label">{r.label}</dt> : null}
                    <dd className="spec-table__value">
                      {r.value}
                      {r.sub ? <span className="spec-table__note">{r.sub}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <RichCopy value={a.body.html} className="product-accordion__body rte" />
          )}
        </details>
      ))}
    </>
  )
}
