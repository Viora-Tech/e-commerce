'use client'

// Adapted from Magic UI's Marquee (MIT). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.
import { useEffect, useRef } from 'react'
import { loadMotion } from '../../lazy-motion'
import type { Image } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import { useReducedMotion } from '../../use-reduced-motion'

type Logo = { image: Image; alt: string; href: string }

type LogoMarqueeProps = { heading: string; logos: Logo[]; speedSeconds: number }

const resolveDuration = (speedSeconds: number): number => Math.max(5, speedSeconds || 30)

function Track({ logos }: { logos: Logo[] }) {
  return (
    <div className="flex shrink-0 items-center gap-[3rem] px-[1.5rem]">
      {logos.map((logo, i) => {
        const key = `${logo.image?.url ?? logo.alt}-${i}`
        const href = safeHref(logo.href)
        const content = logo.image?.url ? (
          <img
            src={logo.image.url}
            alt={logo.alt}
            loading="lazy"
            className="h-[2rem] w-auto opacity-70 grayscale"
          />
        ) : (
          <span className="text-body whitespace-nowrap text-[var(--color-muted)]">
            {logo.alt || 'Brand'}
          </span>
        )
        return (
          <div key={key}>
            {href ? (
              <a href={href} aria-label={logo.alt}>
                {content}
              </a>
            ) : (
              content
            )}
          </div>
        )
      })}
    </div>
  )
}

// Duplicated track animated with Motion, no CSS keyframes, and respects reduced motion (renders
// both tracks static, fully visible). Motion is fetched after hydration, so the page's first-load
// JS never carries it; until it lands the track simply rests at its start.
export default function LogoMarquee({ heading, logos, speedSeconds }: LogoMarqueeProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  const loop = useRef<{ stop(): void } | null>(null)
  useEffect(() => {
    if (reducedMotion) return
    let live = true
    loadMotion()
      .then(({ animate }) => {
        const el = track.current
        if (!live || !el) return
        loop.current = animate(
          el,
          { x: ['0%', '-50%'] },
          { duration: resolveDuration(speedSeconds), repeat: Infinity, ease: 'linear' },
        )
      })
      .catch(() => {})
    return () => {
      live = false
      loop.current?.stop()
      loop.current = null
    }
  }, [speedSeconds, reducedMotion])

  // Event handlers
  const handlePause = () => {
    loop.current?.stop()
  }
  const handleResume = () => {
    const el = track.current
    if (reducedMotion || !el) return
    loadMotion()
      .then(({ animate }) => {
        loop.current?.stop()
        loop.current = animate(
          el,
          { x: ['0%', '-50%'] },
          { duration: resolveDuration(speedSeconds), repeat: Infinity, ease: 'linear' },
        )
      })
      .catch(() => {})
  }

  // Early returns
  if (logos.length === 0) return null

  return (
    <div className="page-width">
      {heading ? (
        <p className="text-caption mb-[1rem] text-center uppercase tracking-[0.08em] text-[var(--color-muted)]">
          {heading}
        </p>
      ) : null}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover pause/resume is a decorative enhancement over an always-fully-rendered track; nothing is keyboard-only reachable through it. */}
      <div
        className="relative flex overflow-hidden"
        onMouseEnter={handlePause}
        onMouseLeave={handleResume}
        style={{
          maskImage: 'linear-gradient(to right,transparent,black 10%,black 90%,transparent)',
          WebkitMaskImage: 'linear-gradient(to right,transparent,black 10%,black 90%,transparent)',
        }}
      >
        <div ref={track} className="flex shrink-0">
          <Track logos={logos} />
          <Track logos={logos} />
        </div>
      </div>
    </div>
  )
}
