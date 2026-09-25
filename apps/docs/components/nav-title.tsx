import type { ReactNode } from 'react'

type NavTitleProps = {
  icon: ReactNode
  children: ReactNode
}

/**
 * Sidebar group heading with a small leading icon, used as a `_meta.tsx`
 * `title`. The icon carries `docs-nav-icon` so breadcrumbs and prev/next
 * links (which reuse the same title) can hide it.
 */
export default function NavTitle({ icon, children }: NavTitleProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="docs-nav-icon inline-flex shrink-0 text-[1rem]" aria-hidden="true">
        {icon}
      </span>
      {children}
    </span>
  )
}
