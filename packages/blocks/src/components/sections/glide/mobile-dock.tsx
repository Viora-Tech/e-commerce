'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { mobileDockContent as copy } from '../../../data/glide/mobile-dock'
import { safeHref } from '../../../slot-types'
import Icon, { isIconName } from '../../icon'

type MobileDockProps = {
  /**
   * Links with a label (plain text on the storefront, Puck's inline editor node on the
   * canvas); the section drops blank ones, as the theme skips a block with no label.
   */
  links: { icon: string; label: ReactNode; url: string }[]
  cartCount: number
}

/**
 * Port of sections/mobile-dock.liquid: an app-style bar fixed to the bottom of a phone screen,
 * with up to four links and the cart (with its count) always last. The link for the page
 * being viewed is marked current once the dock knows the path, after hydration.
 */
export default function MobileDock({ links, cartCount }: MobileDockProps) {
  // Hooks
  const [path, setPath] = useState<string | null>(null)
  useEffect(() => setPath(window.location.pathname), [])

  // Render logic
  const shown = links.flatMap((link, i) => {
    const href = safeHref(link.url)
    return href ? [{ key: `${i}-${href}`, href, label: link.label, icon: link.icon }] : []
  })

  return (
    <nav className="mobile-dock" aria-label={copy.nav}>
      <ul className="mobile-dock__list">
        {shown.map((link) => (
          <li key={link.key} className="mobile-dock__item">
            <a
              href={link.href}
              className="mobile-dock__link"
              aria-current={link.href === path ? 'page' : undefined}
            >
              <span className="mobile-dock__icon">
                <Icon name={isIconName(link.icon) ? link.icon : 'search'} size={22} />
              </span>
              <span className="mobile-dock__label text-caption">{link.label}</span>
            </a>
          </li>
        ))}
        <li className="mobile-dock__item">
          <a href="/cart" className="mobile-dock__link">
            <span className="mobile-dock__icon">
              <Icon name="cart" size={22} />
              {cartCount > 0 ? <span className="mobile-dock__cart-count">{cartCount}</span> : null}
            </span>
            <span className="mobile-dock__label text-caption">{copy.cart}</span>
            <span className="visually-hidden">{copy.cartCount(cartCount)}</span>
          </a>
        </li>
      </ul>
    </nav>
  )
}
