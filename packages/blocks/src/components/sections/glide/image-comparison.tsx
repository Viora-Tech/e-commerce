'use client'

// Port of sections/image-comparison.liquid + assets/image-comparison.js: two stacked pictures, the top one clipped at a draggable divider
import { type ReactNode, type SyntheticEvent, useEffect, useRef, useState } from 'react'
import {
  imageComparisonContent as copy,
  IMAGE_COMPARISON,
} from '../../../data/glide/image-comparison'
import { focalStyle } from '../../../focal-point'
import type { Image } from '../../../sections/framed'
import Picture from '../../picture'

type ImageComparisonProps = {
  /** The ReactNode props are strings in storage but React nodes while editing on the canvas. */
  heading: ReactNode
  before: Image | null
  after: Image | null
  labelBefore: ReactNode
  labelAfter: ReactNode
  fit: 'wide' | 'image'
  rotate: '0' | 'left' | 'right'
  /** Percent, 100 = no zoom. */
  zoom: number
  /** Percent from the left where the divider rests. */
  start: number
}

const PERCENT = 100

const clampPercent = (n: number) => Math.min(PERCENT, Math.max(0, Number.isFinite(n) ? n : 50))

/** One of the two stacked layers; a placeholder until both pictures are set. */
function Layer({ image, side }: { image: Image | null; side: 'before' | 'after' }) {
  return (
    <div className={`image-comparison__media image-comparison__media--${side}`}>
      {image ? (
        <Picture
          image={image}
          alt={image.alt}
          style={focalStyle(image.focal)}
          fill
          placeholder={false}
          loading="lazy"
          sizes="(min-width: 990px) 1200px, 100vw"
        />
      ) : (
        <div className="image-comparison__placeholder" aria-hidden="true" />
      )}
    </div>
  )
}

export default function ImageComparison({
  heading,
  before,
  after,
  labelBefore,
  labelAfter,
  fit,
  rotate,
  zoom,
  start,
}: ImageComparisonProps) {
  // Hooks
  const [divider, setDivider] = useState(clampPercent(start))
  const [ratio, setRatio] = useState<number>(IMAGE_COMPARISON.fallbackRatio)
  const frame = useRef<HTMLDivElement>(null)
  const touched = useRef(false)
  useEffect(() => setDivider(clampPercent(start)), [start])
  useEffect(() => {
    const el = frame.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || touched.current) return
        seen.disconnect()
        const target = clampPercent(start)
        let began: number | null = null
        el.style.setProperty('--divider', '0%')
        const step = (now: number) => {
          if (touched.current) return
          began ??= now
          const progress = Math.min((now - began) / IMAGE_COMPARISON.sweepMs, 1)
          const eased = 1 - (1 - progress) ** 3
          el.style.setProperty('--divider', `${target * eased}%`)
          if (progress < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
      },
      { threshold: IMAGE_COMPARISON.sweepThreshold },
    )
    seen.observe(el)
    return () => {
      seen.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [start])

  // Event handlers
  const handleInput = (value: string) => {
    touched.current = true
    const next = clampPercent(Number(value))
    frame.current?.style.setProperty('--divider', `${next}%`)
    setDivider(next)
  }
  const handleLoad = (event: SyntheticEvent<HTMLDivElement>) => {
    const img = event.target
    if (!(img instanceof HTMLImageElement)) return
    if (!img.closest('.image-comparison__media--before')) return
    if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
  }

  // Render logic
  const both = Boolean(before?.url && after?.url)
  const style = {
    '--divider': `${divider}%`,
    '--comparison-zoom': (zoom || PERCENT) / PERCENT,
    ...(both && fit === 'image' ? { '--comparison-ratio': ratio } : {}),
  } as React.CSSProperties

  return (
    <div className="section-image-comparison page-width">
      {heading ? <h2 className="image-comparison__heading h2">{heading}</h2> : null}
      <div
        ref={frame}
        className={`image-comparison${rotate !== '0' ? ` image-comparison--rotate-${rotate}` : ''}`}
        style={style}
        onLoadCapture={fit === 'image' ? handleLoad : undefined}
      >
        <Layer image={both ? after : null} side="after" />
        <Layer image={both ? before : null} side="before" />
        {labelBefore ? (
          <span className="image-comparison__label image-comparison__label--before">
            {labelBefore}
          </span>
        ) : null}
        {labelAfter ? (
          <span className="image-comparison__label image-comparison__label--after">
            {labelAfter}
          </span>
        ) : null}
        <input
          className="image-comparison__range"
          type="range"
          min={0}
          max={PERCENT}
          step={0.1}
          value={divider}
          aria-label={copy.ariaLabel}
          onChange={(e) => handleInput(e.target.value)}
        />
        <div className="image-comparison__divider" aria-hidden="true">
          <span className="image-comparison__grip">
            <svg
              width="12"
              height="16"
              viewBox="0 0 12 16"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M2 2v12M6 2v12M10 2v12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}
