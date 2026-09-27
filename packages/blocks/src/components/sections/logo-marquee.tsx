'use client'

// Adapted from Magic UI's Marquee (MIT). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import type { Image } from '../../sections/framed'

type Logo = { image: Image; alt: string; href: string }

type LogoMarqueeProps = { heading: string; logos: Logo[]; speedSeconds: number }

const resolveDuration = (speedSeconds: number): number => Math.max(5, speedSeconds || 30)

function Track({ logos }: { logos: Logo[] }) {
  return (
    <div className="flex shrink-0 items-center gap-[3rem] px-[1.5rem]">
      {logos.map((logo, i) => {
        const key = `${logo.image?.url ?? logo.alt}-${i}`
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
            {logo.href ? (
              <a href={logo.href} aria-label={logo.alt}>
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

// Duplicated track animated with Motion, no CSS keyframes, so the mask/pause-on-hover behaviour
// stays declarative and respects reduced motion (renders both tracks static, fully visible).
export default function LogoMarquee({ heading, logos, speedSeconds }: LogoMarqueeProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const controls = useAnimationControls()
  useEffect(() => {
    if (reducedMotion) return
    controls.start({
      x: ['0%', '-50%'],
      transition: { duration: resolveDuration(speedSeconds), repeat: Infinity, ease: 'linear' },
    })
  }, [controls, speedSeconds, reducedMotion])

  // Event handlers
  const handlePause = () => {
    if (!reducedMotion) controls.stop()
  }
  const handleResume = () => {
    if (!reducedMotion) {
      controls.start({
        x: ['0%', '-50%'],
        transition: { duration: resolveDuration(speedSeconds), repeat: Infinity, ease: 'linear' },
      })
    }
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
        <motion.div className="flex shrink-0" animate={controls}>
          <Track logos={logos} />
          <Track logos={logos} />
        </motion.div>
      </div>
    </div>
  )
}
