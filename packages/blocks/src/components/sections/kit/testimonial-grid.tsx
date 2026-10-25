// Pattern after common masonry testimonial walls (our own implementation). See
// THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import KitHeading from './kit-heading'
import KitStars from './kit-stars'

/** Copy is a string in storage, a React node while edited on the canvas (ratings stay numbers). */
type TestimonialGridProps = {
  heading: ReactNode
  text: ReactNode
  starsLabel: (rating: number) => string
  quotes: { quote: ReactNode; author: ReactNode; role: ReactNode; rating: number }[]
}

/** First letter of a name for the round badge; a name being edited (a node) gets none. */
function initial(author: ReactNode): string {
  return typeof author === 'string' ? author.trim().charAt(0).toUpperCase() : ''
}

/** Customer quotes in a masonry wall of cards: one column on phones, up to three on desktop. */
export default function TestimonialGrid({
  heading,
  text,
  starsLabel,
  quotes,
}: TestimonialGridProps) {
  // Early returns
  if (!quotes?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <div className="columns-1 gap-[1rem] sm:columns-2 lg:columns-3">
        {quotes.map((q, i) => (
          <figure
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            key={i}
            className="mb-[1rem] flex break-inside-avoid flex-col gap-[1rem] text-left rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[1.5rem]"
          >
            <KitStars rating={q.rating} label={starsLabel(q.rating)} />
            <blockquote className="text-body text-[var(--color-ink)]">{q.quote}</blockquote>
            <figcaption className="flex items-center gap-[0.75rem]">
              <span
                aria-hidden
                className="flex size-[2.25rem] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-brand)_14%,transparent)] text-[0.875rem] font-semibold text-[var(--color-brand)]"
              >
                {initial(q.author)}
              </span>
              <span className="flex flex-col">
                <span className="text-small font-semibold text-[var(--color-ink)]">{q.author}</span>
                {q.role ? (
                  <span className="text-caption text-[var(--color-muted)]">{q.role}</span>
                ) : null}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
