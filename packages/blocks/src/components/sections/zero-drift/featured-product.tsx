'use client'

// Port of sections/featured-product.liquid: one product's buy box, the same lockup the Featured carousel draws
import { type ReactNode, useEffect, useState } from 'react'
import { featuredProductContent as copy } from '../../../data/zero-drift/featured-product'
import type { CardProduct } from '../../../types'
import FeaturedCarouselSlide from './featured-carousel-slide'

type FeaturedProductProps = {
  product: CardProduct | null
  /** The ReactNode props are strings in storage but React nodes while editing on the canvas. */
  eyebrow: ReactNode
  text: ReactNode
  buttonLabel: ReactNode
  imageSide: 'left' | 'right'
  showStamp: boolean
  stampText: string
  showShare: boolean
  showHelp: boolean
  helpHref: string
}

export default function FeaturedProduct({
  product,
  eyebrow,
  text,
  buttonLabel,
  imageSide,
  showStamp,
  stampText,
  showShare,
  showHelp,
  helpHref,
}: FeaturedProductProps) {
  // Hooks
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  // Early returns
  if (!product) {
    return (
      <div className="section-featured-product page-width">
        <p className="featured-carousel__empty text-body">{copy.empty}</p>
      </div>
    )
  }

  return (
    <div className="section-featured-product page-width">
      <FeaturedCarouselSlide
        product={product}
        eyebrow={eyebrow}
        flip={imageSide === 'right'}
        showStamp={showStamp}
        stampText={stampText}
        showShare={showShare}
        showHelp={showHelp}
        helpHref={helpHref}
        origin={origin}
        text={text}
        buttonLabel={buttonLabel}
      />
    </div>
  )
}
