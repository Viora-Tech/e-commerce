// Pattern after shadcnblocks' split hero layouts (our own implementation). See THIRD_PARTY_NOTICES.md.

import { focalStyle } from '../../focal-point'
import { linkTarget } from '../../link'
import type { Image, Link } from '../../sections/framed'

type SplitHeroProps = {
  eyebrow: string
  heading: string
  text: string
  button: Link
  image: Image
  imageFirst: boolean
}

const PLACEHOLDER_GRADIENT =
  'linear-gradient(135deg,color-mix(in_oklab,var(--color-brand)_25%,transparent),color-mix(in_oklab,var(--color-accent)_20%,transparent))'

export default function SplitHero({
  eyebrow,
  heading,
  text,
  button,
  image,
  imageFirst,
}: SplitHeroProps) {
  return (
    <div className="page-width grid grid-cols-1 items-center gap-[2rem] md:grid-cols-2 md:gap-[3rem]">
      <div className={imageFirst ? 'order-2 md:order-2' : 'order-2 md:order-1'}>
        {eyebrow ? (
          <p className="text-caption mb-[0.75rem] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            {eyebrow}
          </p>
        ) : null}
        {heading ? <h1 className="h1 text-[var(--color-ink)]">{heading}</h1> : null}
        {text ? <p className="text-body mt-[1rem] text-[var(--color-muted)]">{text}</p> : null}
        {button?.label ? (
          <a
            className="btn btn--primary mt-[1.5rem] inline-flex"
            href={button.href || '#'}
            {...linkTarget(button)}
          >
            {button.label}
          </a>
        ) : null}
      </div>
      <div className={imageFirst ? 'order-1 md:order-1' : 'order-1 md:order-2'}>
        {image?.url ? (
          <img
            className="aspect-[4/5] w-full rounded-[var(--radius-card)] object-cover"
            src={image.url}
            alt={image.alt}
            style={focalStyle(image.focal)}
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden
            className="aspect-[4/5] w-full rounded-[var(--radius-card)]"
            style={{ backgroundImage: PLACEHOLDER_GRADIENT }}
          />
        )}
      </div>
    </div>
  )
}
