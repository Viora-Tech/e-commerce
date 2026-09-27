'use client'

import type { FocalPoint } from '@commerce/blocks/media'
import { focalFromPoint, normaliseFocal, nudgeFocal, Picture } from '@commerce/blocks/media'
import { motion, useReducedMotion } from 'motion/react'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { MediaVariants } from '@/components/media/media-pick-types'
import { customizeContent } from '@/data/customize'

type ImageFocalPreviewProps = {
  url: string
  alt: string
  focal: unknown
  /** Known right after a pick from the library; unknown for a stored url, which then loads plain. */
  variants: MediaVariants | null
  thumbhash: string | null
  onFocal: (focal: FocalPoint) => void
}

const copy = customizeContent.image

/** Arrow keys move the point 5% at a time, 1% with Shift held. */
const KEY_STEP: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * The image at its own shape, with the focal point marked. Clicking the image
 * (or the arrow keys, once focused) moves the point; blocks that crop the
 * image keep that spot in view (`object-position`). The click is measured
 * against the image itself, not its frame, so the point maps onto the real
 * picture whatever its shape.
 */
export default function ImageFocalPreview({
  url,
  alt,
  focal,
  variants,
  thumbhash,
  onFocal,
}: ImageFocalPreviewProps) {
  // Hooks
  const reducedMotion = useReducedMotion()

  // Event handlers
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const img = e.currentTarget.querySelector('img')
    if (!img) return
    onFocal(focalFromPoint(img.getBoundingClientRect(), e.clientX, e.clientY))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = KEY_STEP[e.key]
    if (!step) return
    e.preventDefault()
    const size = e.shiftKey ? 1 : 5
    onFocal(nudgeFocal(focal, step[0] * size, step[1] * size))
  }

  // Render logic
  const point = normaliseFocal(focal) ?? { x: 50, y: 50 }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={copy.focalLabel(point.x, point.y)}
      title={copy.focalHint}
      className="relative mx-auto inline-flex max-w-full cursor-crosshair rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Picture
        image={{ url, alt, variants, thumbhash }}
        alt={alt}
        width={640}
        height={400}
        sizes="20rem"
        className="block h-auto max-h-56 w-auto max-w-full rounded-md object-contain"
      />
      <motion.span
        aria-hidden
        initial={false}
        animate={{ left: `${point.x}%`, top: `${point.y}%` }}
        transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
        className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground/30 shadow-md ring-1 ring-foreground/40"
      >
        <span className="absolute inset-1.5 rounded-full bg-background" />
      </motion.span>
    </button>
  )
}
