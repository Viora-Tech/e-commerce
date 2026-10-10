// Port of blocks/_product-description.liquid (the "description only" source): the product's own description, set as the theme's product document.
import { RichTextRenderer, type RichTextValue } from '@commerce/richtext'

type ProductDocProps = { doc: RichTextValue }

export default function ProductDoc({ doc }: ProductDocProps) {
  return (
    <div className="product-doc">
      <section className="product-doc__section product-doc__prose rte">
        <RichTextRenderer data={doc} />
      </section>
    </div>
  )
}
