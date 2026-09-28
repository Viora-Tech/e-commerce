'use client'

import { linkTarget } from '../../link'
import type { Image, Link } from '../../sections/framed'
import { safeHref } from '../../slot-types'
// Pattern after shadcnblocks' video hero layouts (our own implementation). See THIRD_PARTY_NOTICES.md.
import { useReducedMotion } from '../../use-reduced-motion'
import Picture from '../picture'

type VideoHeroProps = {
  videoUrl: string
  poster: Image
  overlayOpacity: number
  heading: string
  text: string
  button: Link
}

const PLACEHOLDER_GRADIENT =
  'linear-gradient(135deg,color-mix(in_oklab,var(--color-ink)_60%,transparent),color-mix(in_oklab,var(--color-brand)_35%,transparent))'

// Full-bleed muted autoplay loop. Under reduced motion the poster (or a token gradient when
// there is none) shows instead, and the <video> element is never mounted.
export default function VideoHero({
  videoUrl,
  poster,
  overlayOpacity,
  heading,
  text,
  button,
}: VideoHeroProps) {
  // Hooks
  const reducedMotion = useReducedMotion()

  // Render logic
  const showVideo = Boolean(videoUrl) && !reducedMotion
  const overlay = Math.min(90, Math.max(0, overlayOpacity)) / 100

  return (
    <div className="relative isolate flex min-h-[32rem] flex-col items-center justify-center overflow-hidden px-[1rem] py-[4rem] text-center">
      {showVideo ? (
        <video
          className="absolute inset-0 size-full object-cover"
          src={videoUrl}
          poster={poster?.url || undefined}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : poster?.url ? (
        <Picture
          image={poster}
          alt={poster.alt}
          className="absolute inset-0 size-full object-cover"
          fill
          sizes="100vw"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: PLACEHOLDER_GRADIENT }}
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
      <div className="page-width relative flex flex-col items-center gap-[1.25rem]">
        {heading ? <h1 className="h1 text-white">{heading}</h1> : null}
        {text ? <p className="text-body max-w-[36rem] text-white/85">{text}</p> : null}
        {button?.label ? (
          <a
            className="btn btn--primary"
            href={safeHref(button.href) ?? '#'}
            {...linkTarget(button)}
          >
            {button.label}
          </a>
        ) : null}
      </div>
    </div>
  )
}
