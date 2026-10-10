// Pattern after common single-quote testimonial layouts (our own implementation). See
// THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import { focalStyle } from '../../../focal-point'
import type { Image } from '../../../sections/framed'
import Picture from '../../picture'

/** Copy is a string in storage, a React node while edited on the canvas. */
type TestimonialSpotlightProps = {
  quote: ReactNode
  author: ReactNode
  role: ReactNode
  photo: Image
}

/** One customer quote, large and centred, with the person's photo and name under it. */
export default function TestimonialSpotlight({
  quote,
  author,
  role,
  photo,
}: TestimonialSpotlightProps) {
  // Render logic
  return (
    <div className="page-width flex justify-center">
      <figure className="flex max-w-[52rem] flex-col items-center gap-[2rem] text-center">
        <span
          aria-hidden
          className="font-[family-name:var(--font-heading)] text-[5rem] leading-[0.6] text-[var(--color-brand)]"
        >
          “
        </span>
        {/* Not `.h3`: the theme's heading classes are uppercase and outrank utilities. */}
        <blockquote className="font-[family-name:var(--font-heading)] text-[1.5rem] leading-[1.35] text-balance text-[var(--color-ink)] md:text-[2rem]">
          {quote}
        </blockquote>
        <figcaption className="flex items-center gap-[0.875rem]">
          {photo?.url ? (
            <span className="relative size-[3rem] overflow-hidden rounded-full">
              <Picture
                image={photo}
                alt={photo.alt}
                className="absolute inset-0 size-full object-cover"
                style={focalStyle(photo.focal)}
                fill
                sizes="48px"
              />
            </span>
          ) : null}
          <span className="flex flex-col items-start">
            <span className="text-body font-semibold text-[var(--color-ink)]">{author}</span>
            {role ? <span className="text-small text-[var(--color-muted)]">{role}</span> : null}
          </span>
        </figcaption>
      </figure>
    </div>
  )
}
