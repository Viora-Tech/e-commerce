import type { ReactNode } from 'react'
import { modernSectionsContent } from '../../data/modern-sections'
import { linkTarget } from '../../link'
import type { Link } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import CountdownTiles from '../countdown-tiles'

type SaleCountdownProps = {
  badge: ReactNode
  heading: ReactNode
  /** The line before the code ("Extra 5% with code"); blank hides the line. */
  codeText: ReactNode
  code: string
  /** ISO date and time the sale ends; past or blank hides the tiles. */
  endsAt: string
  button: Link
}

const copy = modernSectionsContent.saleCountdown

/**
 * Figma Section / Sale countdown (708:120169): a bordered card with the sale tag, the headline
 * and the code on the left, the days / hours / minutes / seconds tiles and the button on the
 * right. The tiles count down live and step aside once the sale is over.
 */
export default function SaleCountdown({
  badge,
  heading,
  codeText,
  code,
  endsAt,
  button,
}: SaleCountdownProps) {
  // Render logic
  const href = safeHref(button?.href)

  return (
    <div className="sale-countdown page-width">
      <div className="sale-countdown__card">
        <div className="sale-countdown__copy">
          {badge ? <span className="badge badge--sale sale-countdown__badge">{badge}</span> : null}
          {heading ? <h2 className="sale-countdown__heading">{heading}</h2> : null}
          {codeText || code ? (
            <p className="sale-countdown__code-line">
              {codeText}
              {code ? <span className="sale-countdown__code">{code}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="sale-countdown__side">
          <CountdownTiles
            deadline={endsAt}
            labels={copy.labels}
            classes={{
              root: 'sale-countdown__tiles',
              tile: 'sale-countdown__tile',
              value: 'sale-countdown__value',
              label: 'sale-countdown__unit',
            }}
          />
          {button?.label && href ? (
            <a
              className="btn btn--primary sale-countdown__button"
              href={href}
              {...linkTarget(button)}
            >
              {button.label}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
