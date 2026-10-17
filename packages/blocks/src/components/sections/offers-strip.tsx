import type { ReactNode } from 'react'
import { linkTarget } from '../../link'
import type { Link } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import Icon, { isIconName } from '../icon'

type Offer = { icon: string; title: ReactNode; text: ReactNode; link: Link }

type OffersStripProps = { heading: ReactNode; offers: Offer[] }

/**
 * Figma Section / EMI & offers strip (706:118585): a small heading over outlined cards, one per
 * offer (no-cost EMI, a bank offer, UPI cashback, a bundle), each with its icon, the offer in a
 * line and a "Details" link.
 */
export default function OffersStrip({ heading, offers }: OffersStripProps) {
  // Early returns
  if (offers.length === 0) return null

  // Render logic
  return (
    <div className="offers-strip page-width">
      {heading ? <p className="offers-strip__heading">{heading}</p> : null}
      <ul className="offers-strip__list">
        {offers.map((o, i) => {
          const href = safeHref(o.link?.href)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <li key={i} className="offers-strip__card">
              <p className="offers-strip__title">
                <Icon name={isIconName(o.icon) ? o.icon : 'payment'} size={16} />
                {o.title}
              </p>
              {o.text ? <p className="offers-strip__text">{o.text}</p> : null}
              {o.link?.label && href ? (
                <a className="offers-strip__link" href={href} {...linkTarget(o.link)}>
                  {o.link.label}
                </a>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
