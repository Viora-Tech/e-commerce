import type { ReactNode } from 'react'
import { sectionsContent } from '../../data/sections'
import type { CardCollection } from '../../types'
import Icon from '../icon'
import SectionHeading from '../section-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Props = {
  kicker?: ReactNode
  heading: ReactNode
  /** The title under the image (default) or over its foot. */
  style?: 'below' | 'overlay' | undefined
  collections: CardCollection[]
  empty: string
}

const copy = sectionsContent.collectionList

// Figma Section / Collection list (705:113696), from sections/collection-list.liquid: the shared
// section heading with "View all", then square collection tiles with the name, the product count
// and an arrow, under the image or over it.
export default function CollectionList({
  kicker,
  heading,
  style = 'below',
  collections,
  empty,
}: Props) {
  return (
    <div className={`collection-list collection-list--${style} page-width`}>
      {heading ? (
        <SectionHeading
          kicker={kicker}
          heading={heading}
          viewAll={{ href: '/collections', label: copy.viewAll }}
        />
      ) : null}
      {collections.length === 0 ? <p className="text-caption">{empty}</p> : null}
      <ul className="collection-list__grid">
        {collections.map((c) => (
          <li key={c.handle}>
            <a className="collection-list__card" href={`/collections/${c.handle}`}>
              <span className="collection-list__media">
                {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" /> : null}
              </span>
              <span className="collection-list__info">
                <span className="collection-list__text">
                  <span className="collection-list__title">{c.title}</span>
                  <span className="collection-list__count">{copy.count(c.productCount)}</span>
                </span>
                <Icon name="arrow-right" size={16} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
