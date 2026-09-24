type Props = {
  image: { url: string; alt: string }
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
        {image?.url ? <img src={image.url} alt={image.alt} loading="lazy" /> : null}
      </div>
      <div className="image-with-text__content">
        {heading ? <h2 className="h2">{heading}</h2> : null}
        {text ? <p className="text-body">{text}</p> : null}
        {button.label ? (
          <a className="btn btn--secondary" href={button.href || '/'}>
            {button.label}
          </a>
        ) : null}
      </div>
    </div>
  )
}
