import type { ReactNode } from 'react'
import { navigationContent } from '../data/navigation'
import { type MenuCollection, menuCardsFor } from '../header-menu'
import { type HeaderSettings, headerSettings } from '../sections/glide/header'
import type { NavLink, ThemeMode } from '../types'
import HeaderDrawer from './header-drawer'
import HeaderMore from './header-more'
import HeaderNav from './header-nav'
import Icon from './icon'
import StickyHeader from './sticky-header'
import ThemeToggle from './theme-toggle'

export type { NavLink }

type HeaderProps = {
  storeName: string
  /** The merchant's logo from the theme; the store name as text when unset. */
  /** `height` keeps the file's aspect ratio at `width`, so the header reserves its space before the logo loads (no layout shift). */
  logo?: { url: string; width: number; height?: number | undefined } | null
  links: NavLink[]
  themeMode: ThemeMode
  showThemeToggle: boolean
  cartCount?: number | undefined
  /** The app's search control (predictive search); a plain link to /search when absent. */
  search?: ReactNode
  /** The Header section's settings (`headerSettings`); the theme's defaults when absent. */
  settings?: HeaderSettings | undefined
  /** The store's collections, for menu card images and titles. */
  collections?: MenuCollection[] | undefined
}

const copy = navigationContent

// Port of sections/header.liquid: logo, nested nav (dropdowns and full-width panels with
// cards), search, cart and the one menu, the mobile drawer, and the sticky wrapper.
export default function Header({
  storeName,
  links,
  themeMode,
  showThemeToggle,
  cartCount = 0,
  logo = null,
  search = null,
  settings,
  collections = [],
}: HeaderProps) {
  // Render logic
  const s = settings ?? headerSettings({})
  const cards = Object.fromEntries(
    links.map((link) => [
      link.id,
      menuCardsFor(link, s.featureCards, collections, s.showMenuImages),
    ]),
  )

  return (
    <StickyHeader sticky={s.sticky}>
      <header className="header page-width">
        <div className={`header__row header__row--logo-${s.logoPosition}`}>
          <div className="only-mobile">
            <HeaderDrawer storeName={storeName} links={links} />
          </div>
          <a href="/" className="header__logo">
            {logo ? (
              <img
                src={logo.url}
                alt={storeName}
                width={logo.width}
                height={logo.height}
                className="header__logo-image header__logo-image--sized"
              />
            ) : (
              <span className="header__logo-text">{storeName}</span>
            )}
          </a>
          <div className="header__nav only-desktop">
            <HeaderNav links={links} cards={cards} menuHover={s.menuHover} />
          </div>
          <div className="header__icons">
            {showThemeToggle ? (
              <ThemeToggle initial={themeMode} className="header__icon-btn header__mobile-only" />
            ) : null}
            {search ?? (
              <a href="/search" className="header__icon-btn" aria-label={copy.search}>
                <Icon name="search" size={24} />
              </a>
            )}
            <a
              href="/account"
              className="header__icon-btn header__mobile-only"
              aria-label={copy.account}
            >
              <Icon name="user" size={24} />
            </a>
            <a
              href="/cart"
              className="header__icon-btn header__cart-link"
              aria-label={copy.cart(cartCount)}
            >
              <Icon name="cart" size={24} />
              {cartCount > 0 ? <span className="header__cart-count">{cartCount}</span> : null}
            </a>
            <HeaderMore
              showWishlist={s.showWishlist}
              themeMode={showThemeToggle ? themeMode : null}
            />
          </div>
        </div>
      </header>
    </StickyHeader>
  )
}
