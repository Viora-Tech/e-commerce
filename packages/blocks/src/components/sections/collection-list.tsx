import type { CardCollection } from '../../types'

type Props = { heading: string; collections: CardCollection[]; empty: string }

// Port of sections/collection-list.liquid: collection tiles with image and title.
export default function CollectionList({ heading, collections, empty }: Props) {
  return (
    <div className="collection-list page-width">
      {heading ? <h2 className="collection-list__heading h2">{heading}</h2> : null}
      {collections.length === 0 ? <p className="text-caption">{empty}</p> : null}
      <ul className="collection-list__grid">
        {collections.map((c) => (
          <li key={c.handle}>
            <a className="collection-list__card" href={`/collections/${c.handle}`}>
              <span className="collection-list__media">
                {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" /> : null}
              </span>
              <span className="collection-list__title h5">{c.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
