import type { ReactNode } from 'react'
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
  imageFirst: boolean
}

// Port of sections/image-with-text.liquid: two columns, image and copy.
export default function ImageWithText({ image, heading, text, button, imageFirst }: Props) {
  return (
    <div className={`image-with-text page-width${imageFirst ? '' : ' image-with-text--reverse'}`}>
      <div className="image-with-text__media">
        {image?.url ? (
          <Picture
            image={image}
            alt={image.alt}
            style={focalStyle(image.focal)}
            fill
            sizes="(min-width: 750px) 50vw, 100vw"
          />
        ) : null}
      </div>
      <div className="image-with-text__content">
        {heading ? <h2 className="h2">{heading}</h2> : null}
        <RichCopy value={text} className="text-body" />
        {button.label ? (
          <a
            className="btn btn--secondary"
            href={safeHref(button.href) ?? '/'}
            {...linkTarget(button)}
          >
            {button.label}
          </a>
        ) : null}
      </div>
    </div>
  )
}
