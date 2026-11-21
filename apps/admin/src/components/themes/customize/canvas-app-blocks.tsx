'use client'

import { ReviewsCarousel, type StoreReviews } from '@commerce/blocks'
import { APP_BLOCK_MISSING_ATTR, APP_BLOCK_SLOT_ATTR } from '@commerce/core/theme-import'
import { type RefObject, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { canvasAppBlocksContent as copy } from '@/data/canvas-app-blocks'
import { themeEditorAppsContent } from '@/data/theme-editor-apps'
import { useCopy } from '@/hooks/use-copy'
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
 * like the storefront. An app block we have no app for shows the server's placeholder, labelled
 * here in the merchant's language.
 */
export default function CanvasAppBlocks({ box, html }: CanvasAppBlocksProps) {
  // Hooks
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [reviews, setReviews] = useState<StoreReviews | null>(null)
  const apps = useCopy(themeEditorAppsContent)

  useEffect(() => {
    const found =
      html && box.current
        ? box.current.querySelector<HTMLElement>(`[${APP_BLOCK_SLOT_ATTR}="reviews-carousel"]`)
        : null
    setSlot(found)
  }, [box, html])

  useEffect(() => {
    if (!html || !box.current) return
    for (const el of box.current.querySelectorAll<HTMLElement>(`[${APP_BLOCK_MISSING_ATTR}]`))
      el.textContent = apps.missingBlock(el.getAttribute(APP_BLOCK_MISSING_ATTR) ?? '')
  }, [box, html, apps])

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
