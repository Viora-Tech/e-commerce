'use client'

import { animate, stagger } from 'motion'
import { useReducedMotion } from 'motion/react'
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react'
import { DRAWER, remToPx } from '../data/motion'
import { navigationContent } from '../data/navigation'
import type { NavLink } from '../types'
import Icon from './icon'

type HeaderDrawerProps = { storeName: string; links: NavLink[] }

const copy = navigationContent

/** The page stops scrolling under an open drawer (base.css html.overlay-open). */
function lockScroll(locked: boolean): void {
  document.documentElement.classList.toggle('overlay-open', locked)
}

/**
 * The mobile menu: a slide-in drawer where each level opens as an accordion
 * (native details, so it works before hydration). Each section starts with the
 * parent's own link, since the parent row itself only expands. Motion slides the
 * panel in and out (Glide's overlay-motion.js); reduced motion opens it instantly.
 */
export default function HeaderDrawer({ storeName, links }: HeaderDrawerProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLButtonElement>(null)
  const closingRef = useRef(false)
  useEffect(() => {
    lockScroll(open)
    const panel = panelRef.current
    const scrim = scrimRef.current
    if (!panel || !scrim) return
    if (!open) {
      // Shut now: hand the resting state back to the stylesheet for the next open.
      panel.style.transform = ''
      scrim.style.opacity = ''
      return
    }
    if (reduce) return
    animate(panel, { x: ['-100%', '0%'] }, DRAWER.in)
    animate(scrim, { opacity: [0, 1] }, DRAWER.scrim)
    animate(
      panel.querySelectorAll('.header-drawer__item'),
      { opacity: [0, 1], y: [remToPx(DRAWER.itemRiseRem), 0] },
      { ...DRAWER.in, delay: stagger(DRAWER.itemStep, { startDelay: 0.08 }) },
    )
  }, [open, reduce])
  useEffect(() => () => lockScroll(false), [])

  // Event handlers
  const handleClose = async () => {
    const panel = panelRef.current
    const scrim = scrimRef.current
    if (closingRef.current) return
    if (!reduce && panel && scrim) {
      closingRef.current = true
      await Promise.all([
        animate(panel, { x: '-100%' }, DRAWER.out),
        animate(scrim, { opacity: 0 }, DRAWER.out),
      ])
      closingRef.current = false
    }
    setOpen(false)
    toggleRef.current?.focus()
  }

  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    // The <details> would shut in one frame; hold it open until the exit has played.
    event.preventDefault()
    if (open) handleClose()
    else setOpen(true)
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: <summary> is natively interactive (keyboard and click); the handler only defers its close. */}
      <summary
        ref={toggleRef}
        onClick={handleSummaryClick}
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
        ref={scrimRef}
        tabIndex={-1}
        className="header-drawer__scrim"
        aria-label={copy.closeMenu}
        onClick={handleClose}
      />
      <div ref={panelRef} className="header-drawer__panel">
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
              <li key={link.id} className="header-drawer__item">
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
                        <li key={child.id}>
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
                                  <li key={leaf.id}>
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
