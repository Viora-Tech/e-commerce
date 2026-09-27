import type { CardProduct } from '../../types'
import Picture from '../picture'
import Price from '../price'

type Props = {
  kicker: string
  text: string
  button: string
  product: CardProduct | null
  empty: string
}

// Port of sections/featured-product.liquid: one product, large image and a call to action.
export default function FeaturedProduct({ kicker, text, button, product, empty }: Props) {
  if (!product) {
    return (
      <div className="page-width">
        <p className="text-caption">{empty}</p>
      </div>
    )
  }
  const image = product.images[0]
  return (
    <div className="featured-product page-width">
      <div className="featured-product__media">
        {image ? (
          // `object-fit: contain` on a tinted ground: no ThumbHash, it would show in the letterbox.
          <Picture
            image={image}
            alt={image.alt ?? product.title}
            fill
            placeholder={false}
            sizes="(min-width: 750px) 50vw, 100vw"
          />
        ) : null}
      </div>
      <div className="featured-product__content">
        {kicker ? <p className="text-caption">{kicker}</p> : null}
        <h2 className="h2">{product.title}</h2>
        <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} />
        {text ? <p className="text-body">{text}</p> : null}
        <a className="btn btn--primary" href={`/products/${product.handle}`}>
          {button}
        </a>
      </div>
    </div>
  )
}
