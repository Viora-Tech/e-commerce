'use client'

import { useRef, useState } from 'react'
import { mainProductContent as copy } from '../data/glide/main-product'
import Lens from '../effects/lens'
import type { MediaImage } from '../types'
import Icon from './icon'
import Picture from './picture'
import ProductGalleryLightbox, { isVideo } from './product-gallery-lightbox'

type ProductGalleryProps = {
  images: MediaImage[]
  /** Alt text for media that has none of its own. */
  title: string
  slide: number
  onSelect: (index: number) => void
  layout: 'rail' | 'stacked'
  /** Aceternity Lens over the main image (desktop, fine pointer, motion allowed). */
  lensZoom: boolean
}

const ui = copy.ui.gallery

/** A thumbnail is at most 80px wide (160 on a 2x screen): the smallest variant, not the original. */
const thumbSrc = (img: MediaImage) => img.variants?.['320']?.webp ?? img.url

const wrap = (index: number, length: number) => (index + length) % length

// Port of snippets/product-gallery.liquid (main stage + prev/next, thumbnail rail, phone
// dots, click-to-zoom lightbox) and the `stacked` layout from sections/main-product.liquid.
// The theme's hover zoom was a vanilla re-implementation of Aceternity's Lens; this uses
// the shared original (`../effects/lens.tsx`).
export default function ProductGallery({
  images,
  title,
  slide,
  onSelect,
  layout,
  lensZoom,
}: ProductGalleryProps) {
  // Hooks
  const [shown, setShown] = useState(slide)
  const [previous, setPrevious] = useState<number | null>(null)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [lightbox, setLightbox] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Helpers
  // A pick from outside (a variant with its own image) moves the stage too; the outgoing
  // slide keeps `was-active` so the carousel CSS can slide both together. Adjusted while
  // rendering (React's "state from props" pattern), not in an effect, so no frame is lost.
  const followSlide = () => {
    if (slide === shown) return
    setPrevious(shown)
    setDirection(slide > shown ? 'forward' : 'back')
    setShown(slide)
  }

  // Event handlers
  const handleStep = (step: 1 | -1) => onSelect(wrap(slide + step, images.length))
  const handleZoom = (index: number) => {
    dialogRef.current?.showModal()
    // A frame later, so the dialog has an un-faded state to transition from.
    requestAnimationFrame(() => setLightbox(index))
  }
  const handleLightboxClose = () => setLightbox(null)

  // Early returns
  followSlide()
  if (images.length === 0) {
    return (
      <div className="product-gallery product-gallery--placeholder">
        <div className="product-gallery__main" />
      </div>
    )
  }
  if (layout === 'stacked') {
    return (
      <div className="stacked-gallery">
        {images.map((img, i) => (
          <figure key={img.url} className="stacked-gallery__frame">
            {isVideo(img) ? (
              <video src={img.url} controls muted loop playsInline preload="metadata" />
            ) : (
              <Picture
                image={img}
                alt={img.alt ?? title}
                width={1400}
                height={1400}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                sizes="(min-width: 990px) 58vw, 100vw"
              />
            )}
          </figure>
        ))}
      </div>
    )
  }

  // Render logic
  const many = images.length > 1

  return (
    <div className="product-gallery">
      <div className="product-gallery__stage">
        <div className="product-gallery__main" data-direction={direction}>
          {images.map((img, i) => {
            const picture = (
              <Picture
                image={img}
                alt={img.alt ?? title}
                width={1200}
                height={1200}
                fill
                placeholder={false}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                sizes="(min-width: 990px) 50vw, 100vw"
              />
            )
            return (
              <div
                key={img.url}
                className={`product-gallery__slide${i === slide ? ' is-active' : ''}${i === previous && i !== slide ? ' was-active' : ''}`}
                aria-hidden={i !== slide}
              >
                {isVideo(img) ? (
                  <video
                    src={img.url}
                    controls
                    muted
                    playsInline
                    preload={i === 0 ? 'metadata' : 'none'}
                    aria-label={img.alt ?? title}
                  />
                ) : (
                  <button
                    type="button"
                    className="product-gallery__zoom"
                    aria-label={ui.zoom}
                    tabIndex={i === slide ? 0 : -1}
                    onClick={() => handleZoom(i)}
                  >
                    {lensZoom ? (
                      <Lens className="product-gallery__lens h-full w-full">{picture}</Lens>
                    ) : (
                      picture
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {many ? (
          <>
            <button
              type="button"
              className="product-gallery__nav product-gallery__nav--prev"
              aria-label={ui.previous}
              onClick={() => handleStep(-1)}
            >
              <Icon name="arrow" size={18} />
            </button>
            <button
              type="button"
              className="product-gallery__nav product-gallery__nav--next"
              aria-label={ui.next}
              onClick={() => handleStep(1)}
            >
              <Icon name="arrow" size={18} />
            </button>
          </>
        ) : null}
      </div>
      {many ? (
        <div className="product-gallery__rail">
          <div className="product-gallery__thumbs">
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                className={`product-gallery__thumb${i === slide ? ' is-active' : ''}`}
                aria-label={ui.viewMedia(i + 1)}
                aria-current={i === slide}
                onClick={() => onSelect(i)}
              >
                {isVideo(img) ? (
                  <video src={img.url} muted playsInline preload="metadata" />
                ) : (
                  <img src={thumbSrc(img)} alt="" width={80} height={80} loading="lazy" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {many ? (
        <div className="product-gallery__dots">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              className={`product-gallery__dot${i === slide ? ' is-active' : ''}`}
              aria-label={ui.viewMedia(i + 1)}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>
      ) : null}
      <ProductGalleryLightbox
        ref={dialogRef}
        images={images}
        title={title}
        index={lightbox}
        onIndex={setLightbox}
        onClose={handleLightboxClose}
      />
    </div>
  )
}
