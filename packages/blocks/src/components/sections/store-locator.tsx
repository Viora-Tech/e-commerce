'use client'

import { type ReactNode, useState } from 'react'
import { modernSectionsContent } from '../../data/modern-sections'
import Icon from '../icon'
import SectionHeading from '../section-heading'

type Store = { name: ReactNode; address: string; hours: ReactNode }

type StoreLocatorProps = { kicker?: ReactNode; heading: ReactNode; stores: Store[] }

const copy = modernSectionsContent.storeLocator

const directionsHref = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`

const embedSrc = (address: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`

/**
 * Figma Section / Store locator (708:120661): the store list on the left (name, area, today's
 * hours, Directions), the map of the chosen store on the right. The map is Google's embed, which
 * sets cookies, so it only loads once the shopper asks to see it.
 */
export default function StoreLocator({ kicker, heading, stores }: StoreLocatorProps) {
  // Hooks
  const [active, setActive] = useState(0)
  const [mapOn, setMapOn] = useState(false)

  // Early returns
  if (stores.length === 0) return null

  // Render logic
  const chosen = stores[Math.min(active, stores.length - 1)]

  return (
    <div className="store-locator page-width">
      {heading ? <SectionHeading kicker={kicker} heading={heading} /> : null}
      <div className="store-locator__body">
        <ul className="store-locator__list">
          {stores.map((s, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <li key={i}>
              <div className="store-locator__store" data-active={i === active ? '' : undefined}>
                <button
                  type="button"
                  className="store-locator__pick"
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                >
                  <span className="store-locator__name">{s.name}</span>
                  <span className="store-locator__address">{s.address}</span>
                </button>
                <p className="store-locator__meta">
                  {s.hours ? (
                    <span className="store-locator__hours">
                      <span className="store-locator__dot" aria-hidden="true" />
                      {s.hours}
                    </span>
                  ) : null}
                  {s.address ? (
                    <a
                      className="store-locator__directions"
                      href={directionsHref(s.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {copy.directions}
                    </a>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="store-locator__map">
          {mapOn && chosen?.address ? (
            <iframe
              key={chosen.address}
              src={embedSrc(chosen.address)}
              title={copy.mapTitle}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="store-locator__frame"
            />
          ) : (
            <button type="button" className="store-locator__show" onClick={() => setMapOn(true)}>
              <span className="store-locator__pin" aria-hidden="true">
                <Icon name="location" size={18} />
              </span>
              {copy.showMap}
              <span className="store-locator__map-note">{copy.mapNote}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
