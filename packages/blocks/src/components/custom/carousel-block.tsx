import type { CSSProperties } from 'react'
import { customSectionsContent as copy } from '../../data/custom-sections'
import { rem } from '../../element-style'
import { asSlot } from '../../slot-types'
import ElementBox from './element-box'

export type CarouselProps = {
  slides: { content: unknown }[]
  perView: { mobile: number; tablet: number; desktop: number }
  gap: number
  style: unknown
}

const per = (n: unknown, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(Math.max(n, 1), 6) : fallback

/**
 * A carousel on CSS scroll snap: swipe on touch, scroll or arrow keys once
 * focused, no JavaScript. Slides per view are set per breakpoint through a
 * CSS variable, so widths are right in the server HTML (no layout shift).
 */
export default function CarouselBlock({ slides, perView, gap, style }: CarouselProps) {
  // Render logic
  const items = slides ?? []
  const vars = {
    '--per-m': per(perView?.mobile, 1),
    '--per-t': per(perView?.tablet, 2),
    '--per-d': per(perView?.desktop, 3),
    '--gap': rem(gap, 120) ?? '0rem',
  } as CSSProperties

  return (
    <ElementBox look={style} className="custom-carousel w-full">
      <section
        aria-roledescription="carousel"
        aria-label={copy.carousel.label}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must take focus so keyboard users can scroll it.
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-[var(--gap)] overflow-x-auto scroll-smooth pb-2 [--per:var(--per-m)] focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:scroll-auto md:[--per:var(--per-t)] lg:[--per:var(--per-d)]"
        style={vars}
      >
        {items.map((slide, i) => {
          const Slide = asSlot(slide?.content)
          return (
            // biome-ignore lint/a11y/useSemanticElements: the APG carousel pattern marks each slide as a group; a fieldset would imply a form.
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: slides pair with their slot by position.
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={copy.carousel.slide(i + 1, items.length)}
              className="shrink-0 grow-0 basis-[calc((100%-(var(--per)-1)*var(--gap))/var(--per))] snap-start"
            >
              <Slide className="flex h-full flex-col gap-3" minEmptyHeight={96} />
            </div>
          )
        })}
      </section>
    </ElementBox>
  )
}
