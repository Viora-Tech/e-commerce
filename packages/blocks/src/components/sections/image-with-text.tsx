import type { ReactNode } from 'react'
import { focalStyle } from '../../focal-point'
import type { Image } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import HeroCopy from '../hero-copy'
import Picture from '../picture'

type Props = {
  image: Image
  /** Copy is a string in storage, a React node while edited on the canvas. */
  kicker?: ReactNode
  heading: ReactNode
  text: ReactNode
  button: { label: ReactNode; href: string; newTab?: boolean | undefined }
  imageFirst: boolean
}

// Figma Section / Image with text (707:118517), from sections/image-with-text.liquid: the photo
// on a surface panel beside an eyebrow, a 32px heading, the text and an outline button.
export default function ImageWithText({ image, kicker, heading, text, button, imageFirst }: Props) {
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
        <HeroCopy
          as="h2"
          size="section"
          eyebrow={kicker}
          heading={heading}
          text={text}
          secondary={{ ...button, href: safeHref(button.href) ?? '/' }}
        />
      </div>
    </div>
  )
}
