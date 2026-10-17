import { formatPaise } from '../money'

// Port of snippets/price.liquid, as Figma Store / Price (691:85138): the price (in the sale
// colour when discounted), the MRP struck through and the saving in rupees.
export default function Price({
  pricePaise,
  mrpPaise,
}: {
  pricePaise: number
  mrpPaise: number | null
}) {
  const onSale = mrpPaise != null && mrpPaise > pricePaise
  return (
    <div className={`price${onSale ? ' price--on-sale' : ''}`}>
      <span className="price__current">{formatPaise(pricePaise)}</span>
      {onSale ? (
        <>
          <span className="price__compare">
            <s>{formatPaise(mrpPaise)}</s>
          </span>
          <span className="price__save">Save {formatPaise(mrpPaise - pricePaise)}</span>
        </>
      ) : null}
    </div>
  )
}
