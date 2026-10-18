import type { ReactNode } from 'react'
import { sectionsContent } from '../../data/sections'
import { focalStyle } from '../../focal-point'
import { linkTarget } from '../../link'
import type { Image, Link } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import Icon from '../icon'
import Picture from '../picture'
import RichCopy from '../rich-copy'
import SectionHeading from '../section-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Column = {
  title: ReactNode
  text: ReactNode
  image?: Image | undefined
  link?: Link | undefined
}

type Props = { kicker?: ReactNode; heading: ReactNode; columns: Column[] }

const copy = sectionsContent.multicolumn

// Figma Section / Multicolumn (707:118686), from sections/multicolumn.liquid: a centred section
// heading over surface cards, each an icon tile, a title, a short line and "Learn more".
export default function Multicolumn({ kicker, heading, columns }: Props) {
  return (
    <div className="multicolumn page-width">
      {heading ? <SectionHeading kicker={kicker} heading={heading} align="center" /> : null}
      <ul className="multicolumn__list">
        {columns.map((c, i) => {
          const href = safeHref(c.link?.href)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <li key={i} className="multicolumn__item">
              {c.image?.url ? (
                <span className="multicolumn__media">
                  <Picture
                    image={c.image}
                    alt={c.image.alt}
                    className="multicolumn__image"
                    style={focalStyle(c.image.focal)}
                    fill
                    sizes="(min-width: 750px) 33vw, 100vw"
                  />
                </span>
              ) : null}
              <h3 className="multicolumn__title">{c.title}</h3>
              <RichCopy value={c.text} className="multicolumn__text" />
              {href ? (
                <a className="multicolumn__link" href={href} {...linkTarget(c.link)}>
                  {c.link?.label || copy.learnMore} <Icon name="arrow-right" size={14} />
                </a>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
