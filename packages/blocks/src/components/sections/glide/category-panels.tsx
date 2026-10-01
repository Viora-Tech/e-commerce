'use client'

// Port of sections/category-panels.liquid: a row of tall category panels; the one under the pointer widens, the others narrow to slivers.
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
