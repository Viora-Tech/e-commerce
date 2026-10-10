// Port of sections/logo-carousel.liquid (+ assets/marquee-motion.js): auto-scrolling brand marquee, or a still press strip
import type { CSSProperties, ReactNode } from 'react'
import { logoCarouselContent as copy } from '../../../data/zero-drift/logo-carousel'
import { focalStyle } from '../../../focal-point'
import { safeHref } from '../../../slot-types'
import type { CardCollection } from '../../../types'
import Picture from '../../picture'
import LogoCarouselTrack from './logo-carousel-track'

export type LogoCarouselDisplay = 'tiles' | 'logos' | 'press'

export type LogoCarouselItem = {
  collectionHandle: string
  image: { url: string; alt: string; focal?: { x: number; y: number } | undefined }
  href: string
  label: string
  quote: ReactNode
}

type LogoCarouselProps = {
  /** The ReactNode props are strings in storage but React nodes while editing on the canvas. */
  heading: ReactNode
  display: LogoCarouselDisplay
  pressGrayscale: boolean
  logoHeight: number
  scrollSpeed: number
  pauseOnHover: boolean
  scrollReactive: boolean
  items: LogoCarouselItem[]
  collections: CardCollection[]
}

type Logo = {
  key: string
  imageUrl: string
  focal: { x: number; y: number } | undefined
  href: string | null
  label: string
  quote: ReactNode
}

const PX_PER_REM = 16

/**
 * A block is driven by an uploaded logo, or just by a collection: the picture, name and link
 * fall back to the collection's own, and anything set on the block overrides it. Blocks with
 * no picture at all are skipped, as in the theme.
 */
function resolveLogos(items: LogoCarouselItem[], collections: CardCollection[]): Logo[] {
  const logos: Logo[] = []
  items.forEach((item, i) => {
    const collection = collections.find((c) => c.handle === item.collectionHandle)
    const imageUrl = item.image?.url || collection?.imageUrl || ''
    if (!imageUrl) return
    const handleHref = item.collectionHandle ? `/collections/${item.collectionHandle}` : ''
    logos.push({
      key: `${i}-${item.collectionHandle}`,
      imageUrl,
      focal: item.image?.url ? item.image.focal : undefined,
      href: safeHref(item.href || handleHref),
      label: item.label || collection?.title || copy.fallbackLabel,
      quote: item.quote,
    })
  })
  return logos
}

type LogoProps = { logo: Logo; display: LogoCarouselDisplay; hidden?: boolean }

/** One logo: its picture (and, for tiles, the name) inside a link when it has one. */
function LogoMark({ logo, display, hidden }: LogoProps) {
  const caption = display === 'tiles'
  const media = (
    <span className="logo-carousel__media">
      <Picture
        image={{ url: logo.imageUrl, alt: '' }}
        alt=""
        fill
        placeholder={false}
        loading={display === 'press' ? 'lazy' : 'eager'}
        fetchPriority="low"
        sizes={caption ? '(min-width: 750px) 200px, 150px' : '160px'}
        style={logo.focal ? focalStyle(logo.focal) : undefined}
      />
    </span>
  )
  if (logo.href) {
    return (
      <a
        href={logo.href}
        className="logo-carousel__logo"
        aria-label={caption ? undefined : logo.label}
        tabIndex={hidden ? -1 : undefined}
      >
        {media}
        {caption ? <span className="logo-carousel__name">{logo.label}</span> : null}
      </a>
    )
  }
  return (
    <span className="logo-carousel__logo">
      {media}
      {caption ? (
        <span className="logo-carousel__name">{logo.label}</span>
      ) : (
        <span className="visually-hidden">{logo.label}</span>
      )}
    </span>
  )
}

export default function LogoCarousel({
  heading,
  display,
  pressGrayscale,
  logoHeight,
  scrollSpeed,
  pauseOnHover,
  scrollReactive,
  items,
  collections,
}: LogoCarouselProps) {
  // Render logic
  const logos = resolveLogos(items, collections)
  const modifiers = [
    `logo-carousel--${display}`,
    pauseOnHover ? 'logo-carousel--pause-on-hover' : '',
    display === 'press' && pressGrayscale ? 'logo-carousel--press-grayscale' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const vars = {
    '--logo-height': `${logoHeight / PX_PER_REM}rem`,
    '--marquee-duration': `${scrollSpeed}s`,
  } as CSSProperties

  return (
    <div className="section-logo-carousel page-width">
      {heading ? <p className="logo-carousel__heading text-caption">{heading}</p> : null}

      {logos.length === 0 ? (
        <p className="logo-carousel__empty text-caption">{copy.empty}</p>
      ) : (
        <div className={`logo-carousel ${modifiers}`} style={vars}>
          {display === 'press' ? (
            logos.map((logo) => (
              <div key={logo.key} className="logo-carousel__press-item">
                <LogoMark logo={logo} display={display} />
                {logo.quote ? (
                  <p className="logo-carousel__quote text-small">&ldquo;{logo.quote}&rdquo;</p>
                ) : null}
              </div>
            ))
          ) : (
            <LogoCarouselTrack scrollReactive={scrollReactive}>
              {[0, 1].map((run) => (
                <div
                  key={run}
                  className="logo-carousel__run"
                  aria-hidden={run === 1 ? true : undefined}
                >
                  {logos.map((logo) => (
                    <LogoMark key={logo.key} logo={logo} display={display} hidden={run === 1} />
                  ))}
                </div>
              ))}
            </LogoCarouselTrack>
          )}
        </div>
      )}
    </div>
  )
}
