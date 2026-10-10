// Port of sections/product-features.liquid: image and copy side by side, alternating sides down the page.
import type { ReactNode } from 'react'
import { productFeaturesContent as copy } from '../../../data/zero-drift/product-features'
import { type FocalPoint, focalStyle } from '../../../focal-point'
import Picture from '../../picture'
import RichCopy from '../../rich-copy'

type ProductFeaturesProps = {
  features: {
    image: { url: string; alt: string; focal?: FocalPoint | undefined }
    heading: ReactNode
    text: ReactNode
    layout: string
  }[]
}

/** `auto` alternates: even rows image left, odd rows image right. */
const sideOf = (layout: string, index: number) =>
  layout === 'image-left' || layout === 'image-right'
    ? layout
    : index % 2 === 0
      ? 'image-left'
      : 'image-right'

export default function ProductFeatures({ features }: ProductFeaturesProps) {
  return (
    <div className="section-product-features">
      {features.map((feature, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: features have no id and are reordered only in the editor.
          key={i}
          className={`product-feature product-feature--${sideOf(feature.layout, i)}`}
        >
          <div className="product-feature__media">
            {feature.image.url ? (
              <Picture
                image={feature.image}
                alt={feature.image.alt}
                fill
                loading="lazy"
                sizes={copy.imageSizes}
                style={focalStyle(feature.image.focal)}
              />
            ) : null}
          </div>
          <div className="product-feature__content">
            {feature.heading ? (
              <h2 className="product-feature__heading h3">{feature.heading}</h2>
            ) : null}
            <RichCopy value={feature.text} className="product-feature__text text-body rte" />
          </div>
        </div>
      ))}
    </div>
  )
}
