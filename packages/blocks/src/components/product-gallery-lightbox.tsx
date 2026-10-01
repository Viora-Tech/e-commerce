'use client'

import type { Ref } from 'react'
import { mainProductContent as copy } from '../data/glide/main-product'
import type { MediaImage } from '../types'
import Icon from './icon'
import Picture from './picture'

type ProductGalleryLightboxProps = {
  ref: Ref<HTMLDialogElement>
  images: MediaImage[]
  title: string
  /** Index into `images` of the picture on show; null while closed (or still opening). */
  index: number | null
  onIndex: (index: number) => void
  onClose: () => void
}

const ui = copy.ui.gallery

export const isVideo = (img: { contentType?: string | null | undefined }) =>
  img.contentType?.startsWith('video/') ?? false

/** Positions in `images` of the pictures (videos already play in place). */
const pictureIndexes = (images: MediaImage[]) =>
  images.flatMap((img, i) => (isVideo(img) ? [] : [i]))

// The click-to-zoom <dialog> from snippets/product-gallery.liquid: the full picture on the
// page's own ground, with previous/next through the product's images (videos are skipped,
// as in the theme, since they already play in place).
export default function ProductGalleryLightbox({
  ref,
  images,
  title,
  index,
  onIndex,
  onClose,
}: ProductGalleryLightboxProps) {
  // Event handlers
  const handleStep = (step: 1 | -1) => {
    const at = index === null ? -1 : pictures.indexOf(index)
    if (at < 0) return
    const next = pictures[(at + step + pictures.length) % pictures.length]
    if (next !== undefined) onIndex(next)
  }
  const handleClose = (event: { currentTarget: HTMLButtonElement }) =>
    event.currentTarget.closest('dialog')?.close()

  // Render logic
  const pictures = pictureIndexes(images)
  const many = pictures.length > 1

  return (
    <dialog
      ref={ref}
      className={`product-gallery__lightbox${index === null ? '' : ' is-visible'}`}
      aria-label={ui.lightbox}
      onClose={onClose}
    >
      <button
        type="button"
        className="product-gallery__lightbox-close"
        aria-label={copy.ui.close}
        onClick={handleClose}
      >
        <Icon name="close" size={16} />
      </button>
      {many ? (
        <button
          type="button"
          className="product-gallery__lightbox-nav product-gallery__lightbox-nav--prev"
          aria-label={ui.previous}
          onClick={() => handleStep(-1)}
        >
          <Icon name="arrow" size={20} />
        </button>
      ) : null}
      <div className="product-gallery__lightbox-stage">
        {pictures.map((i) => {
          const img = images[i] as MediaImage
          return (
            <Picture
              key={img.url}
              image={img}
              alt={img.alt ?? title}
              className={`product-gallery__lightbox-image${i === index ? ' is-active' : ''}`}
              width={1600}
              height={1600}
              placeholder={false}
              loading="lazy"
              sizes="100vw"
            />
          )
        })}
      </div>
      {many ? (
        <button
          type="button"
          className="product-gallery__lightbox-nav product-gallery__lightbox-nav--next"
          aria-label={ui.next}
          onClick={() => handleStep(1)}
        >
          <Icon name="arrow" size={20} />
        </button>
      ) : null}
    </dialog>
  )
}
