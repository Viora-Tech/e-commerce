import { focalStyle } from '../../focal-point'
import { linkTarget } from '../../link'
import type { Image } from '../../sections/framed'
import Picture from '../picture'

type Props = {
  image: Image
  heading: string
  text: string
  button: { label: string; href: string }
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
        {text ? <p className="text-body">{text}</p> : null}
        {button.label ? (
          <a className="btn btn--secondary" href={button.href || '/'} {...linkTarget(button)}>
            {button.label}
          </a>
        ) : null}
      </div>
    </div>
  )
}
