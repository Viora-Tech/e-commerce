import type { ReactNode } from 'react'
import { safeHref } from '../slot-types'

// Port of snippets/section-heading.liquid.
export default function SectionHeading({
  kicker,
  heading,
  viewAll,
  align = 'left',
}: {
  /** Strings in storage, React nodes while a section's copy is edited on the canvas. */
  kicker?: ReactNode
  heading: ReactNode
  viewAll?: { href: string; label: string }
  /** Centred over the content (multicolumn) or the default left. */
  align?: 'left' | 'center' | undefined
}) {
  // Render logic
  const viewAllHref = safeHref(viewAll?.href)

  return (
    <div className={`section-heading section-heading--${align}`}>
      <div className="section-heading__text">
        {kicker ? <p className="section-heading__kicker text-caption">{kicker}</p> : null}
        <h2 className="section-heading__title h2">{heading}</h2>
      </div>
      {viewAll && viewAllHref ? (
        <a href={viewAllHref} className="section-heading__view-all">
          {viewAll.label}
        </a>
      ) : null}
    </div>
  )
}
