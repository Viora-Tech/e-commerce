// Figma Section / Category panels (705:113892), from sections/category-panels.liquid: a bento of
// category panels - the first tall on the left, the rest stacked beside it - each with its name,
// a short line and "Shop now" over the photo's foot.
import type { ReactNode } from 'react'
import { categoryPanelsContent as copy } from '../../../data/zero-drift/category-panels'
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
  // Early returns
  if (panels.length === 0) return <p className="category-panels__empty">{copy.empty}</p>

  // Render logic
  return (
    <div className="category-panels__row">
      {panels.map((panel, i) => (
        <a
          // biome-ignore lint/suspicious/noArrayIndexKey: panels have no id and are reordered only in the editor.
          key={i}
          className={`category-panel${i === 0 ? ' category-panel--lead' : ''}`}
          href={panel.href}
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
          <span className="category-panel__body">
            <span className="category-panel__title">{panel.title}</span>
            <span className="category-panel__meta">{panel.meta}</span>
            <span className="category-panel__cta" aria-hidden="true">
              {copy.cta} <Icon name="arrow-right" size={16} />
            </span>
          </span>
        </a>
      ))}
    </div>
  )
}
