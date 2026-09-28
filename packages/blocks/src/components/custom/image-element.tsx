import { customSectionsContent as copy } from '../../data/custom-sections'
import { focalStyle } from '../../focal-point'
import { linkTarget } from '../../link'
import { cx, safeHref } from '../../slot-types'
import ElementBox from './element-box'

export type ImageElementProps = {
  image: { url: string; alt: string; focal?: { x: number; y: number } | undefined }
  aspect: 'auto' | '1/1' | '4/3' | '16/9' | '3/4'
  fit: 'cover' | 'contain'
  link: { label: string; href: string; newTab?: boolean | undefined }
  style: unknown
}

const ASPECTS = new Set(['1/1', '4/3', '16/9', '3/4'])

/**
 * One picture. A fixed shape reserves its box before the image loads (no
 * layout shift); "Original" keeps the file's own proportions.
 */
export default function ImageElement({ image, aspect, fit, link, style }: ImageElementProps) {
  // Render logic
  const ratio = ASPECTS.has(aspect) ? aspect : null
  const href = safeHref(link?.href)
  const picture = image?.url ? (
    <img
      src={image.url}
      alt={image.alt ?? ''}
      loading="lazy"
      decoding="async"
      className={cx(
        'block w-full',
        ratio && 'h-full',
        fit === 'contain' ? 'object-contain' : 'object-cover',
      )}
      style={focalStyle(image.focal)}
    />
  ) : (
    <div className="flex size-full min-h-32 items-center justify-center bg-[var(--color-surface)] text-sm text-[var(--color-muted)]">
      {copy.empty.image}
    </div>
  )

  return (
    <ElementBox look={style} className="custom-image overflow-hidden">
      <div style={ratio ? { aspectRatio: ratio } : undefined} className="w-full overflow-hidden">
        {href ? (
          <a href={href} aria-label={link.label || image?.alt || undefined} {...linkTarget(link)}>
            {picture}
          </a>
        ) : (
          picture
        )}
      </div>
    </ElementBox>
  )
}
