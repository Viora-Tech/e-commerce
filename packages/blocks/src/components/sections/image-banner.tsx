import type { CSSProperties, ReactNode } from 'react'
import { focalStyle } from '../../focal-point'
import type { Image, Link } from '../../sections/framed'
import HeroCopy from '../hero-copy'
import Picture from '../picture'

type Props = {
  image: Image
  /** Copy is a string in storage, a React node while edited on the canvas. */
  eyebrow?: ReactNode
  heading: ReactNode
  text: ReactNode
  button: { label: ReactNode; href: string; newTab?: boolean | undefined }
  secondaryButton?: Link | undefined
  height: 'small' | 'medium' | 'large'
  align: 'left' | 'center' | 'right'
  overlay: number
  /** Set by the storefront on a template's first section: this image is likely the LCP. */
  _aboveFold?: boolean | undefined
}

// Figma Section / Image banner (704:113894), from sections/image-banner.liquid: a full-bleed
// photo under a scrim, 400 / 560 / 720px tall, the hero copy on the left, centre or right.
export default function ImageBanner({
  image,
  eyebrow,
  heading,
  text,
  button,
  secondaryButton,
  height,
  align,
  overlay,
  _aboveFold,
}: Props) {
  // Render logic
  const style = { '--banner-overlay': Math.min(90, Math.max(0, overlay)) / 100 } as CSSProperties

  return (
    <div className={`image-banner image-banner--${height} image-banner--${align}`} style={style}>
      {image?.url ? (
        <Picture
          image={image}
          alt={image.alt}
          className="image-banner__media"
          style={focalStyle(image.focal)}
          fill
          sizes="100vw"
          loading={_aboveFold ? 'eager' : 'lazy'}
          fetchPriority={_aboveFold ? 'high' : undefined}
        />
      ) : null}
      <div className="image-banner__content page-width">
        <HeroCopy
          as="h2"
          eyebrow={eyebrow}
          heading={heading}
          text={text}
          primary={button}
          secondary={secondaryButton}
          className={align === 'left' ? undefined : `hero-copy--${align}`}
        />
      </div>
    </div>
  )
}
