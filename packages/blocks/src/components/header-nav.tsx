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
import type { MenuCard } from '../header-menu'
import type { NavLink } from '../types'
import { useNavIndicator } from '../use-nav-indicator'
import HeaderMenuPanel from './header-menu-panel'
import Icon from './icon'

type HeaderNavProps = {
  links: NavLink[]
  /** Each top-level item's dropdown cards, by its id (`header-menu.ts`). */
  cards?: Record<string, MenuCard[]> | undefined
  /** The hover indicator: a glowing underline or a sliding pill. */
  menuHover?: 'underline' | 'pill' | undefined
}

const copy = navigationContent

/** A parent whose children have children of their own opens the full-width mega menu. */
function isMega(link: NavLink): boolean {
  return (link.children ?? []).some((child) => (child.children?.length ?? 0) > 0)
}

/**
 * True only inside Customize's preview iframe (`data-customize-preview`,
 * set by `PreviewFrame`), before the pointer has genuinely moved there. A
 * section mounting under a stationary cursor — e.g. right after selecting it
 * in the tree — can otherwise fire a real `pointerenter` that opens a nav
 * dropdown nobody asked to open. The live storefront never sets this
 * attribute, so hover-to-open there is unaffected.
 */
function isHoverIntentSuppressed(): boolean {
  const root = document.documentElement
  return root.hasAttribute('data-customize-preview') && !root.hasAttribute('data-pointer-moved')
}

/**
 * The desktop menu. A top-level item with children opens on hover (with a short
 * intent delay), click or keyboard: a dropdown for two levels, the full-width
 * panel for three levels or when the item has cards (grouped columns or a list on
 * the left, cards on the right). Arrow keys walk the open panel, Escape closes it
 * and returns focus to its trigger. An underline or pill follows the pointer.
 */
export default function HeaderNav({ links, cards = {}, menuHover = 'underline' }: HeaderNavProps) {
  // Hooks
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const { indicatorRef, moveTo, hide } = useNavIndicator(menuHover)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // The indicator rests on the open item, and leaves with the pointer once nothing is open.
  useEffect(() => {
    const list = navRef.current?.querySelector('.header__menu-list')
    if (openIndex !== null) moveTo(list?.querySelector(`[data-item="${openIndex}"]`))
    else if (!list?.matches(':hover')) hide()
  }, [openIndex, moveTo, hide])

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
  const handlePointerEnter = (index: number | null, event: PointerEvent<HTMLLIElement>) => {
    // Touch fires pointerenter too; there, the click that follows is the intent.
    if (event.pointerType !== 'mouse') return
    moveTo(event.currentTarget)
    if (index !== null && isHoverIntentSuppressed()) return
    const opening = index !== null && openIndex === null
    schedule(index, opening ? MENU_OPEN_DELAY_MS : 0)
  }

  const handlePointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    if (openIndex === null) hide()
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
      <ul className={`header__menu-list ${menuHover === 'pill' ? 'has-nav-pill' : 'has-nav-line'}`}>
        <li ref={indicatorRef} className="header__menu-pill" aria-hidden="true" />
        {links.map((link, index) => {
          const children = link.children ?? []
          if (children.length === 0) {
            return (
              <li
                key={link.id}
                className="header__menu-item"
                onPointerEnter={(event) => handlePointerEnter(null, event)}
                onFocus={(event) => moveTo(event.currentTarget)}
              >
                <a href={link.href} className="header__menu-link">
                  {link.label}
                </a>
              </li>
            )
          }
          const mega = isMega(link)
          const itemCards = cards[link.id] ?? []
          const wide = mega || itemCards.length > 0
          const open = openIndex === index
          const panelId = `header-menu-${index}`
          return (
            <li
              key={link.id}
              data-item={index}
              className={
                wide ? 'header__menu-item' : 'header__menu-item header__menu-item--dropdown'
              }
              onPointerEnter={(event) => handlePointerEnter(index, event)}
              onFocus={(event) => moveTo(event.currentTarget)}
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
              {wide ? (
                <div
                  id={panelId}
                  data-panel={index}
                  className={`header__expansion-panel${open ? ' is-open' : ''}`}
                >
                  <div className="header__expansion-panel-inner">
                    <div className="page-width">
                      <HeaderMenuPanel link={link} columns={mega} cards={itemCards} />
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
                      <li key={child.id}>
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
