'use client'

import { useEffect, useRef, useState } from 'react'
import { headerContent as copy } from '../data/glide/header'
import type { ThemeMode } from '../types'
import Icon from './icon'
import ThemeToggle from './theme-toggle'

type HeaderMoreProps = {
  showWishlist: boolean
  /** The light/dark switch's starting mode, or null when the switch is not in the header. */
  themeMode: ThemeMode | null
}

/**
 * The header's one menu on desktop (Glide `<header-more>`): the account, the wishlist and the
 * light/dark switch behind one button beside the cart. A native `<details>`, so it opens with
 * no script; this adds closing on an outside click and on Escape (focus returns to the button).
 */
export default function HeaderMore({ showWishlist, themeMode }: HeaderMoreProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!open) return
    const details = detailsRef.current
    const onClick = (event: MouseEvent) => {
      if (details && !details.contains(event.target as Node)) details.open = false
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details) return
      details.open = false
      details.querySelector('summary')?.focus()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Event handlers
  const handleToggle = () => setOpen(detailsRef.current?.open ?? false)

  // Render logic
  return (
    <div className="header__more only-desktop">
      <details ref={detailsRef} className="header__more-details" onToggle={handleToggle}>
        <summary className="header__icon-btn header__more-toggle" aria-label={copy.more}>
          <Icon name="menu" size={24} />
        </summary>
        <div className="header__more-panel">
          <a href="/account" className="header__more-row">
            <Icon name="user" size={18} />
            <span>{copy.account}</span>
          </a>
          {showWishlist ? (
            <a href={copy.wishlistHref} className="header__more-row">
              <Icon name="heart" size={18} />
              <span>{copy.wishlist}</span>
            </a>
          ) : null}
          {themeMode ? (
            <>
              <div className="header__more-sep" aria-hidden="true" />
              <ThemeToggle
                initial={themeMode}
                withLabel
                className="header__more-row header__more-theme"
              />
            </>
          ) : null}
        </div>
      </details>
    </div>
  )
}
