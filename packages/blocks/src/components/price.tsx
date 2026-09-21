import { formatPaise } from '../money'

// Port of snippets/price.liquid.
export default function Price({
  pricePaise,
  mrpPaise,
}: {
  pricePaise: number
  mrpPaise: number | null
}) {
  const onSale = mrpPaise != null && mrpPaise > pricePaise
  const off = onSale ? Math.round((1 - pricePaise / mrpPaise) * 100) : 0
  return (
    <div className={`price${onSale ? ' price--on-sale' : ''}`}>
      <span className="price__current">{formatPaise(pricePaise)}</span>
      {onSale ? (
        <>
          <span className="price__compare">
            <s>{formatPaise(mrpPaise)}</s>
          </span>
          <span className="badge badge--sale price__badge">{off}% off</span>
        </>
      ) : null}
    </div>
  )
}
