import type { ReactNode } from 'react'
import { navigationContent } from '../data/navigation'
import type { NavLink, ThemeMode } from '../types'
import HeaderDrawer from './header-drawer'
import HeaderNav from './header-nav'
import Icon from './icon'
import ThemeToggle from './theme-toggle'

export type { NavLink }

const copy = navigationContent

// Port of sections/header.liquid: logo, nested nav (dropdowns and mega menu),
// icons, and the mobile drawer. The search overlay comes with its own pass.
export default function Header({
  storeName,
  links,
  themeMode,
  showThemeToggle,
  cartCount = 0,
  logo = null,
  search = null,
}: {
  storeName: string
  /** The merchant's logo from the theme; the store name as text when unset. */
  logo?: { url: string; width: number } | null
  links: NavLink[]
  themeMode: ThemeMode
  showThemeToggle: boolean
  cartCount?: number | undefined
  /** The app's search control (predictive search); a plain link to /search when absent. */
  search?: ReactNode
}) {
  return (
    <div className="header-wrapper" data-sticky-type="on-scroll-up">
      <header className="header page-width">
        <div className="header__row header__row--logo-left">
          <div className="only-mobile">
            <HeaderDrawer storeName={storeName} links={links} />
          </div>
          <a href="/" className="header__logo">
            {logo ? (
              <img
                src={logo.url}
                alt={storeName}
                width={logo.width}
                className="header__logo-image header__logo-image--sized"
              />
            ) : (
              <span className="header__logo-text">{storeName}</span>
            )}
          </a>
          <div className="header__nav only-desktop">
            <HeaderNav links={links} />
          </div>
          <div className="header__icons">
            {showThemeToggle ? (
              <ThemeToggle initial={themeMode} className="header__icon-btn" />
            ) : null}
            {search ?? (
              <a href="/search" className="header__icon-btn" aria-label={copy.search}>
                <Icon name="search" size={24} />
              </a>
            )}
            <a href="/account" className="header__icon-btn" aria-label={copy.account}>
              <Icon name="user" size={24} />
            </a>
            <a href="/cart" className="header__icon-btn" aria-label={copy.cart(cartCount)}>
              <Icon name="cart" size={24} />
              {cartCount > 0 ? <span className="header__cart-count">{cartCount}</span> : null}
            </a>
          </div>
        </div>
      </header>
    </div>
  )
}
