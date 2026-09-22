'use client'

import { type KeyboardEvent, useRef, useState } from 'react'
import { navigationContent } from '../data/navigation'
import type { NavLink } from '../types'
import Icon from './icon'

type HeaderDrawerProps = { storeName: string; links: NavLink[] }

const copy = navigationContent

/**
 * The mobile menu: a slide-in drawer where each level opens as an accordion
 * (native details, so it works before hydration). Each section starts with the
 * parent's own link, since the parent row itself only expands.
 */
export default function HeaderDrawer({ storeName, links }: HeaderDrawerProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLElement>(null)

  // Event handlers
  const handleClose = () => {
    setOpen(false)
    toggleRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      handleClose()
    }
  }

  // Render logic
  return (
    <details
      className="header-drawer"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={handleKeyDown}
    >
      <summary
        ref={toggleRef}
        className="header__icon-btn header-drawer__toggle"
        aria-label={open ? copy.closeMenu : copy.openMenu}
      >
        <span className="header-drawer__toggle-icon--open">
          <Icon name="menu" size={24} />
        </span>
        <span className="header-drawer__toggle-icon--close">
          <Icon name="close" size={24} />
        </span>
      </summary>
      <button
        type="button"
        tabIndex={-1}
        className="header-drawer__scrim"
        aria-label={copy.closeMenu}
        onClick={handleClose}
      />
      <div className="header-drawer__panel">
        <div className="header-drawer__head">
          <span className="header__logo-text">{storeName}</span>
          <button
            type="button"
            className="header-drawer__close"
            aria-label={copy.closeMenu}
            onClick={handleClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <nav className="header-drawer__nav" aria-label={copy.mobile}>
          <ul className="header-drawer__list">
            {links.map((link) => (
              <li key={`${link.href}-${link.label}`} className="header-drawer__item">
                {link.children?.length ? (
                  <details className="header-drawer__details">
                    <summary className="header-drawer__link">
                      {link.label}
                      <Icon name="chevron-down" size={14} />
                    </summary>
                    <ul className="header-drawer__sublist">
                      <li>
                        <a href={link.href}>{copy.viewAll(link.label)}</a>
                      </li>
                      {link.children.map((child) => (
                        <li key={`${child.href}-${child.label}`}>
                          {child.children?.length ? (
                            <details className="header-drawer__details">
                              <summary className="header-drawer__link header-drawer__link--sub">
                                {child.label}
                                <Icon name="chevron-down" size={12} />
                              </summary>
                              <ul className="header-drawer__subsublist">
                                <li>
                                  <a href={child.href}>{copy.viewAll(child.label)}</a>
                                </li>
                                {child.children.map((leaf) => (
                                  <li key={`${leaf.href}-${leaf.label}`}>
                                    <a href={leaf.href}>{leaf.label}</a>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            <a href={child.href}>{child.label}</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <a href={link.href} className="header-drawer__link">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </details>
  )
}
