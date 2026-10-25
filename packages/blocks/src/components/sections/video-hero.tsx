'use client'

import { type ReactNode, useRef, useState } from 'react'
import { sectionsContent } from '../../data/sections'
import type { Image, Link } from '../../sections/framed'
// Pattern after shadcnblocks' video hero layouts (our own implementation). See THIRD_PARTY_NOTICES.md.
import { useReducedMotion } from '../../use-reduced-motion'
import HeroCopy from '../hero-copy'
import Icon from '../icon'
import Picture from '../picture'

type VideoHeroProps = {
  videoUrl: string
  poster: Image
  overlayOpacity: number
  eyebrow?: ReactNode
  /** Copy is a string in storage, a React node while edited on the canvas. */
  heading: ReactNode
  text: ReactNode
  button: Link
  secondaryButton?: Link | undefined
  align?: 'left' | 'center' | undefined
}

const copy = sectionsContent.videoHero

/**
 * Figma Section / Video hero (704:113728): a full-bleed muted loop under a scrim, the copy at the
 * bottom (left or centred) and a play / pause button in the corner. Under reduced motion the
 * poster (or the surface) shows instead and the <video> is never mounted.
 */
export default function VideoHero({
  videoUrl,
  poster,
  overlayOpacity,
  eyebrow,
  heading,
  text,
  button,
  secondaryButton,
  align = 'left',
}: VideoHeroProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const video = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)

  // Event handlers
  const handleToggle = () => {
    const el = video.current
    if (!el) return
    if (el.paused) void el.play().catch(() => {})
    else el.pause()
  }

  // Render logic
  const showVideo = Boolean(videoUrl) && !reducedMotion
  const overlay = Math.min(90, Math.max(0, overlayOpacity)) / 100

  return (
    <div className={`video-hero video-hero--${align}`}>
      {showVideo ? (
        <video
          ref={video}
          className="video-hero__media"
          src={videoUrl}
          poster={poster?.url || undefined}
          autoPlay
          loop
          muted
          playsInline
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
        />
      ) : poster?.url ? (
        <Picture image={poster} alt={poster.alt} className="video-hero__media" fill sizes="100vw" />
      ) : null}
      <div aria-hidden className="video-hero__scrim" style={{ opacity: overlay }} />
      <div className="video-hero__inner page-width">
        <HeroCopy
          eyebrow={eyebrow}
          heading={heading}
          text={text}
          primary={button}
          secondary={secondaryButton}
          className={align === 'center' ? 'hero-copy--center' : undefined}
        />
      </div>
      {showVideo ? (
        <button
          type="button"
          className="video-hero__play"
          aria-label={paused ? copy.play : copy.pause}
          onClick={handleToggle}
        >
          <Icon name={paused ? 'play' : 'pause'} size={20} />
        </button>
      ) : null}
    </div>
  )
}
