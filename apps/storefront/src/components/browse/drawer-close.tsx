'use client'

import { Icon } from '@commerce/blocks'

type DrawerCloseProps = {
  label: string
  /** Where the no-JavaScript fallback link goes: the same listing, drawer closed. */
  href: string
}

/** Closes the <details> drawer it sits in; a plain link when scripts are off. */
export default function DrawerClose({ label, href }: DrawerCloseProps) {
  // Event handlers
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    e.currentTarget.closest('details')?.removeAttribute('open')
  }

  // Render logic
  return (
    <a href={href} onClick={handleClick} aria-label={label} className="header__icon-btn">
      <Icon name="close" size={24} />
    </a>
  )
}
