'use client'

// Port of sections/category-panels.liquid: a row of tall category panels; the one under the pointer widens, the others narrow to slivers.
// The theme calls this its Aceternity "expandable cards" pick, but Aceternity's free Expandable Card is a
// click-to-open modal list, not this hover row, and no free original of the row exists. Until the owner
// supplies the Pro original (or picks the free modal pattern), the theme's own behaviour stays: one
// open index and CSS widths, no script ported from the theme.
import { type ReactNode, type SyntheticEvent, useState } from 'react'
import { categoryPanelsContent as copy } from '../../../data/glide/category-panels'
import { type FocalPoint, focalStyle } from '../../../focal-point'
import Icon from '../../icon'
import Picture from '../../picture'

export type CategoryPanel = {
  href: string
  title: ReactNode
  meta: ReactNode
  image: {
    url: string
    alt: string
    focal?: FocalPoint | undefined
    variants?: Record<string, { avif: string; webp: string }> | null | undefined
    thumbhash?: string | null | undefined
  }
}

type CategoryPanelsProps = { panels: CategoryPanel[] }

export default function CategoryPanels({ panels }: CategoryPanelsProps) {
  // Hooks
  const [open, setOpen] = useState(0)

  // Event handlers
  const handleOpen = (e: SyntheticEvent<HTMLAnchorElement>) =>
    setOpen(Number(e.currentTarget.dataset.index))

  // Early returns
  if (panels.length === 0) return <p className="category-panels__empty">{copy.empty}</p>

  // Render logic
  return (
    <div className="category-panels__row">
      {panels.map((panel, i) => (
        <a
          // biome-ignore lint/suspicious/noArrayIndexKey: panels have no id and are reordered only in the editor.
          key={i}
          className={`category-panel${i === open ? ' is-open' : ''}`}
          href={panel.href}
          data-index={i}
          onPointerEnter={handleOpen}
          onFocus={handleOpen}
        >
          {panel.image.url ? (
            <Picture
              image={panel.image}
              alt=""
              className="category-panel__img"
              fill
              loading="lazy"
              sizes={copy.imageSizes}
              style={focalStyle(panel.image.focal)}
            />
          ) : null}
          <span className="category-panel__shade" aria-hidden="true" />
          <span className="category-panel__meta">{panel.meta}</span>
          <span className="category-panel__title">{panel.title}</span>
          <span className="category-panel__cta" aria-hidden="true">
            {copy.cta} <Icon name="arrow" size={14} />
          </span>
        </a>
      ))}
    </div>
  )
}
