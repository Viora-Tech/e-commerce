import type { ReactNode } from 'react'
import type { Link } from '../../sections/framed'
import HeroCopy from '../hero-copy'

/** Copy is a string in storage, a React node while edited on the canvas. */
type CtaBannerProps = {
  kicker?: ReactNode
  heading: ReactNode
  text: ReactNode
  button: Link
  secondaryButton: Link
}

// Figma Section / CTA banner (708:120101): a rounded card on the brand colour (or the surface),
// the eyebrow, heading and line on the left and the two buttons on the right.
export default function CtaBanner({
  kicker,
  heading,
  text,
  button,
  secondaryButton,
}: CtaBannerProps) {
  return (
    <div className="cta-banner page-width">
      <div className="cta-banner__card">
        <HeroCopy
          as="h2"
          size="section"
          eyebrow={kicker}
          heading={heading}
          text={text}
          primary={button}
          secondary={secondaryButton}
          className="cta-banner__copy"
        />
      </div>
    </div>
  )
}
