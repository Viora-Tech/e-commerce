import type { ReactNode } from 'react'
import SectionHeading from '../section-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Item = { quote: ReactNode; author: ReactNode; role: ReactNode }

type Props = { kicker?: ReactNode; heading: ReactNode; items: Item[] }

/** "Rohan Iyer" becomes "RI": the avatar when there is no photo. */
function initials(name: ReactNode): string {
  if (typeof name !== 'string') return ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// Figma Section / Testimonials (707:119156), grid look: the section heading over surface cards
// with the quote, then an initials avatar beside the name and detail.
export default function Testimonials({ kicker, heading, items }: Props) {
  return (
    <div className="testimonials page-width">
      {heading ? <SectionHeading kicker={kicker} heading={heading} /> : null}
      <ul className="testimonials__list">
        {items.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <li key={i} className="testimonials__card">
            <blockquote className="testimonials__quote">{t.quote}</blockquote>
            <div className="testimonials__author">
              {initials(t.author) ? (
                <span className="testimonials__avatar" aria-hidden="true">
                  {initials(t.author)}
                </span>
              ) : null}
              <span className="testimonials__who">
                <strong className="testimonials__name">{t.author}</strong>
                {t.role ? <span className="testimonials__role">{t.role}</span> : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
