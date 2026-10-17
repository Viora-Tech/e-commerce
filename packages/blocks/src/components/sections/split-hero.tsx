// Pattern after shadcnblocks' split hero layouts (our own implementation). See THIRD_PARTY_NOTICES.md.

import type { ReactNode } from 'react'
import { focalStyle } from '../../focal-point'
import type { Image, Link } from '../../sections/framed'
import HeroCopy from '../hero-copy'
import Icon from '../icon'
import Picture from '../picture'

/** Copy is a string in storage, a React node while edited on the canvas. */
type SplitHeroProps = {
  eyebrow: ReactNode
  heading: ReactNode
  text: ReactNode
  button: Link
  /** The outline button beside the main one; hidden without a label. */
  secondaryButton?: Link | undefined
  /** Short reassurances under the buttons, each after a check mark. */
  trust?: { text: ReactNode }[] | undefined
  image: Image
  imageFirst: boolean
  /** Set by the storefront on a template's first section: this image is likely the LCP. */
  _aboveFold?: boolean | undefined
}

/**
 * Figma Section / Split hero (704:113444): eyebrow, a display heading, the text, a solid and
 * an outline button and a trust line on one side; the photo on a surface panel on the other.
 */
export default function SplitHero({
  eyebrow,
  heading,
  text,
  button,
  secondaryButton,
  trust = [],
  image,
  imageFirst,
  _aboveFold,
}: SplitHeroProps) {
  // Render logic
  const items = trust.filter((t) => t.text)

  return (
    <div className={`split-hero page-width${imageFirst ? ' split-hero--media-left' : ''}`}>
      <div className="split-hero__content">
        <HeroCopy
          eyebrow={eyebrow}
          heading={heading}
          text={text}
          primary={button}
          secondary={secondaryButton}
        />
        {items.length > 0 ? (
          <ul className="split-hero__trust">
            {items.map((t, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: items have no id; the editor reorders by position.
              <li key={i} className="split-hero__trust-item">
                <Icon name="check" size={16} />
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="split-hero__media">
        {image?.url ? (
          <Picture
            image={image}
            alt={image.alt}
            className="split-hero__image"
            style={focalStyle(image.focal)}
            fill
            sizes="(min-width: 990px) 620px, 100vw"
            loading={_aboveFold ? 'eager' : 'lazy'}
            fetchPriority={_aboveFold ? 'high' : undefined}
          />
        ) : null}
      </div>
    </div>
  )
}
