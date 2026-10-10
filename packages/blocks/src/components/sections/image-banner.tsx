import type { CSSProperties, ReactNode } from 'react'
import { focalStyle } from '../../focal-point'
import { linkTarget } from '../../link'
import type { Image } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import Picture from '../picture'
import RichCopy from '../rich-copy'

type Props = {
  image: Image
  /** Copy is a string in storage, a React node while edited on the canvas. */
  heading: ReactNode
  text: ReactNode
  button: { label: ReactNode; href: string; newTab?: boolean | undefined }
  height: 'small' | 'medium' | 'large'
  align: 'left' | 'center'
  overlay: number
  /** Set by the storefront on a template's first section: this image is likely the LCP. */
  _aboveFold?: boolean | undefined
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
  _aboveFold,
}: Props) {
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
      ) : (
        <div className="image-banner__media image-banner__media--placeholder" />
      )}
      <div className="image-banner__content page-width">
        {heading ? <h2 className="h1">{heading}</h2> : null}
        <RichCopy value={text} className="text-body" />
        {button.label ? (
          <a
            className="btn btn--primary"
            href={safeHref(button.href) ?? '/collections/all'}
            {...linkTarget(button)}
          >
            {button.label}
          </a>
        ) : null}
      </div>
    </div>
  )
}
