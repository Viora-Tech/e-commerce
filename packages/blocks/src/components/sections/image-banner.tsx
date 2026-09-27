import type { CSSProperties } from 'react'
import { type FocalPoint, focalStyle } from '../../focal-point'
import { linkTarget } from '../../link'

type Props = {
  image: { url: string; alt: string; focal?: FocalPoint | undefined }
  heading: string
  text: string
  button: { label: string; href: string }
  height: 'small' | 'medium' | 'large'
  align: 'left' | 'center'
  overlay: number
}

// Port of sections/image-banner.liquid: full-bleed image, scrim, text and a button.
export default function ImageBanner({
  image,
  heading,
  text,
  button,
  height,
  align,
  overlay,
}: Props) {
  const style = { '--banner-overlay': Math.min(90, Math.max(0, overlay)) / 100 } as CSSProperties
  return (
    <div className={`image-banner image-banner--${height} image-banner--${align}`} style={style}>
      {image?.url ? (
        <img
          className="image-banner__media"
          src={image.url}
          alt={image.alt}
          style={focalStyle(image.focal)}
          loading="lazy"
        />
      ) : (
        <div className="image-banner__media image-banner__media--placeholder" />
      )}
      <div className="image-banner__content page-width">
        {heading ? <h2 className="h1">{heading}</h2> : null}
        {text ? <p className="text-body">{text}</p> : null}
        {button.label ? (
          <a
            className="btn btn--primary"
            href={button.href || '/collections/all'}
            {...linkTarget(button)}
          >
            {button.label}
          </a>
        ) : null}
      </div>
    </div>
  )
}
