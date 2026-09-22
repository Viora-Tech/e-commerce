'use client'

import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { MENU_CLOSE_DELAY_MS, MENU_OPEN_DELAY_MS, navigationContent } from '../data/navigation'
import type { NavLink } from '../types'
import Icon from './icon'

type HeaderNavProps = { links: NavLink[] }

const copy = navigationContent

/** A parent whose children have children of their own opens the full-width mega menu. */
function isMega(link: NavLink): boolean {
  return (link.children ?? []).some((child) => (child.children?.length ?? 0) > 0)
}

/**
 * The desktop menu. A top-level item with children opens on hover (with a short
 * intent delay), click or keyboard: a dropdown for two levels, the full-width
 * mega menu with grouped columns for three. Arrow keys walk the open panel,
 * Escape closes it and returns focus to its trigger.
 */
export default function HeaderNav({ links }: HeaderNavProps) {
  // Hooks
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // Helpers
  const schedule = (next: number | null, delay: number) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpenIndex(next), delay)
  }

  const panelLinks = (index: number) =>
    Array.from(
      navRef.current?.querySelectorAll<HTMLAnchorElement>(`[data-panel="${index}"] a`) ?? [],
    )

  const focusTrigger = (index: number) =>
    navRef.current?.querySelector<HTMLButtonElement>(`[data-trigger="${index}"]`)?.focus()

  // Event handlers
  const handlePointerEnter = (index: number | null, event: PointerEvent) => {
    // Touch fires pointerenter too; there, the click that follows is the intent.
    if (event.pointerType !== 'mouse') return
    const opening = index !== null && openIndex === null
    schedule(index, opening ? MENU_OPEN_DELAY_MS : 0)
  }

  const handlePointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    schedule(null, MENU_CLOSE_DELAY_MS)
  }

  const handleToggle = (index: number) => {
    if (timer.current) clearTimeout(timer.current)
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  const handleTriggerKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setOpenIndex(null)
      return
    }
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    // Commit the open panel now so its first link is visible, and so focusable.
    flushSync(() => setOpenIndex(index))
    panelLinks(index)[0]?.focus()
  }

  // One listener on the nav: it only acts when focus is inside an open panel.
  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const panel = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]')
    if (!panel) return
    const index = Number(panel.dataset.panel)
    const items = panelLinks(index)
    const at = items.indexOf(document.activeElement as HTMLAnchorElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpenIndex(null)
      focusTrigger(index)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(at + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (at <= 0) focusTrigger(index)
      else items[at - 1]?.focus()
    }
  }

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!navRef.current?.contains(event.relatedTarget as Node | null)) setOpenIndex(null)
  }

  // Render logic
  return (
    <nav
      ref={navRef}
      aria-label={copy.primary}
      onPointerLeave={handlePointerLeave}
      onBlur={handleBlur}
      onKeyDown={handlePanelKeyDown}
    >
      <ul className="header__menu-list">
        {links.map((link, index) => {
          const children = link.children ?? []
          if (children.length === 0) {
            return (
              <li
                key={`${link.href}-${link.label}`}
                className="header__menu-item"
                onPointerEnter={(event) => handlePointerEnter(null, event)}
              >
                <a href={link.href} className="header__menu-link">
                  {link.label}
                </a>
              </li>
            )
          }
          const mega = isMega(link)
          const open = openIndex === index
          const panelId = `header-menu-${index}`
          return (
            <li
              key={`${link.href}-${link.label}`}
              className={
                mega ? 'header__menu-item' : 'header__menu-item header__menu-item--dropdown'
              }
              onPointerEnter={(event) => handlePointerEnter(index, event)}
            >
              <button
                type="button"
                className="header__menu-link"
                data-trigger={index}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => handleToggle(index)}
                onKeyDown={(event) => handleTriggerKeyDown(index, event)}
              >
                {link.label}
                <Icon name="chevron-down" size={12} />
              </button>
              {mega ? (
                <div
                  id={panelId}
                  data-panel={index}
                  className={`header__expansion-panel${open ? ' is-open' : ''}`}
                >
                  <div className="header__expansion-panel-inner">
                    <div className="page-width">
                      <div className="header__mega-columns">
                        {children.map((column) => (
                          <div
                            key={`${column.href}-${column.label}`}
                            className="header__mega-column"
                          >
                            <a href={column.href} className="header__mega-heading">
                              {column.label}
                            </a>
                            {column.children?.length ? (
                              <ul className="header__expansion-sublist">
                                {column.children.map((leaf) => (
                                  <li key={`${leaf.href}-${leaf.label}`}>
                                    <a href={leaf.href}>{leaf.label}</a>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      <a href={link.href} className="header__expansion-all">
                        <span className="header__expansion-all-text">
                          {copy.viewAll(link.label)}
                        </span>
                        <Icon name="arrow" size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  id={panelId}
                  data-panel={index}
                  className={`header__dropdown${open ? ' is-open' : ''}`}
                >
                  <ul className="header__dropdown-list">
                    {children.map((child) => (
                      <li key={`${child.href}-${child.label}`}>
                        <a href={child.href} className="header__dropdown-link">
                          {child.label}
                        </a>
                      </li>
                    ))}
                    <li className="header__dropdown-all">
                      <a href={link.href} className="header__dropdown-link">
                        {copy.viewAll(link.label)}
                      </a>
                    </li>
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
