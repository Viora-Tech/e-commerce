'use client'

import { ReviewsCarousel, type StoreReviews } from '@commerce/blocks'
import { APP_BLOCK_SLOT_ATTR } from '@commerce/core/theme-import'
import { type RefObject, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { canvasAppBlocksContent as copy } from '@/data/canvas-app-blocks'
import { api } from '@/lib/api-client'

type CanvasAppBlocksProps = {
  /** The imported section's box on the canvas. */
  box: RefObject<HTMLDivElement | null>
  /** The section's rendered Liquid; a new value means the box's markup was replaced. */
  html: string | null
}

/** As many reviews as the storefront's carousel shows (`liquid-reviews-carousel.tsx`). */
const CAROUSEL_REVIEWS = 12

/**
 * Our widgets in the slots an imported section's Shopify app blocks left (Judge.me's reviews
 * carousel), as the storefront draws them. The canvas renders only the theme's Liquid, so
 * without this the slot is an empty band. Draws nothing when the Reviews app has no reviews,
 * like the storefront.
 */
export default function CanvasAppBlocks({ box, html }: CanvasAppBlocksProps) {
  // Hooks
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [reviews, setReviews] = useState<StoreReviews | null>(null)

  useEffect(() => {
    const found =
      html && box.current
        ? box.current.querySelector<HTMLElement>(`[${APP_BLOCK_SLOT_ATTR}="reviews-carousel"]`)
        : null
    setSlot(found)
  }, [box, html])

  useEffect(() => {
    if (!slot || reviews) return
    let active = true
    api.reviews.widgets({ limit: CAROUSEL_REVIEWS }).then(
      (data) => active && setReviews(data),
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [slot, reviews])

  // Early returns
  if (!slot || !reviews?.reviews.length) return null

  // Render logic
  return createPortal(
    <ReviewsCarousel
      kicker=""
      heading={copy.reviewsCarouselHeading}
      data={reviews}
      showSummary
      showProduct
      showPhotos
      showDate={false}
      cardStyle="card"
      autoplay={false}
      speed={5}
    />,
    slot,
  )
}
