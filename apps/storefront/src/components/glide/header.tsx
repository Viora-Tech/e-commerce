import type { ThemeMode } from '@commerce/core'
import { ThemeToggle } from '@/components/theme-toggle'
import { Icon } from './icon'

export type NavLink = { label: string; href: string }

// Port of sections/header.liquid: logo, inline nav, icons. Mega-menu and
// search overlay come with the interactive pass.
export function Header({
  storeName,
  links,
  themeMode,
  showThemeToggle,
}: {
  storeName: string
  links: NavLink[]
  themeMode: ThemeMode
  showThemeToggle: boolean
}) {
  return (
    <div className="header-wrapper" data-sticky-type="on-scroll-up">
      <header className="header page-width">
        <div className="header__row header__row--logo-left">
          <a href="/" className="header__logo" aria-label={storeName}>
            <span className="header__logo-text">{storeName}</span>
          </a>
          <div className="header__nav only-desktop">
            <nav aria-label="Primary">
              <ul className="header__menu-list">
                {links.map((l) => (
                  <li key={l.href} className="header__menu-item">
                    <a href={l.href} className="header__menu-link">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="header__icons">
            {showThemeToggle ? <ThemeToggle initial={themeMode} /> : null}
            <a href="/search" className="header__icon-btn" aria-label="Search">
              <Icon name="search" size={24} />
            </a>
            <a href="/account" className="header__icon-btn" aria-label="Account">
              <Icon name="user" size={24} />
            </a>
            <a href="/cart" className="header__icon-btn" aria-label="Cart">
              <Icon name="cart" size={24} />
            </a>
          </div>
        </div>
      </header>
    </div>
  )
}
