// Port of the tile markup in sections/promo-bento.liquid: one image or clip with its copy burnt into the lower left.
import type { ReactNode } from 'react'
import { promoBentoContent as copy } from '../../../data/zero-drift/promo-bento'
import { type FocalPoint, focalStyle } from '../../../focal-point'
import { linkTarget } from '../../../link'
import { safeHref } from '../../../slot-types'
import Picture from '../../picture'

export type PromoTileView = {
  size: string
  fit: string
  textTheme: string
  href: string
  newTab: boolean
  videoUrl: string
  image: {
    url: string
    alt: string
    focal?: FocalPoint | undefined
    variants?: Record<string, { avif: string; webp: string }> | null | undefined
    thumbhash?: string | null | undefined
  }
  eyebrow: ReactNode
  title: ReactNode
  subtitle: ReactNode
  /** The merchant's "Show text on this tile" switch. */
  showText: boolean
}

type PromoTileProps = { tile: PromoTileView; reveal: string }

export default function PromoTile({ tile, reveal }: PromoTileProps) {
  // Render logic
  const href = safeHref(tile.href)
  const videoSrc = safeHref(tile.videoUrl)
  const hasCopy = tile.showText && Boolean(tile.eyebrow || tile.title || tile.subtitle)
  const className = [
    'promo-tile',
    `promo-tile--${tile.size}`,
    `promo-tile--fit-${tile.fit}`,
    `promo-tile--text-${tile.textTheme}`,
    hasCopy ? 'promo-tile--has-copy' : '',
    hasCopy && reveal === 'hover' ? 'promo-tile--reveal-hover' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const inner = (
    <>
      <div className="promo-tile__media">
        {videoSrc ? (
          <video
            className="promo-tile__image promo-tile__video"
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
        ) : tile.image.url ? (
          <Picture
            image={tile.image}
            alt={tile.image.alt}
            className="promo-tile__image"
            fill
            loading="lazy"
            sizes={copy.imageSizes}
            style={focalStyle(tile.image.focal)}
          />
        ) : (
          <span className="promo-tile__placeholder" aria-hidden="true" />
        )}
      </div>
      {hasCopy ? (
        <div className="promo-tile__copy">
          {tile.eyebrow ? <span className="promo-tile__eyebrow">{tile.eyebrow}</span> : null}
          {tile.title ? <span className="promo-tile__title">{tile.title}</span> : null}
          {tile.subtitle ? <span className="promo-tile__subtitle">{tile.subtitle}</span> : null}
        </div>
      ) : null}
    </>
  )

  return href ? (
    <a className={className} href={href} {...linkTarget({ newTab: tile.newTab })}>
      {inner}
    </a>
  ) : (
    <div className={className}>{inner}</div>
  )
}
