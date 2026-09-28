'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type MouseEvent, useEffect, useState } from 'react'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type ProductSectionNavProps = {
  /** Only sections actually rendered for this product (e.g. "pricing" is hidden once it has variants). */
  sections: readonly string[]
  /** Told before scrolling, so a collapsed target (the "More" group) can open first. */
  onJump?: (id: string) => void
}

/** Compact jump-link row inside the sticky page header: Media, Details, Pricing… down to More,
 *  highlighting whichever section is in view. */
export default function ProductSectionNav({ sections, onJump }: ProductSectionNavProps) {
  // Hooks
  const { sectionNav: copy } = useCopy(productFormContent)
  const [active, setActive] = useState<string | undefined>(sections[0])

  useEffect(() => {
    const targets = sections
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        )
        setActive(top.target.id)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    for (const el of targets) observer.observe(el)
    return () => observer.disconnect()
  }, [sections])

  // Event handlers
  const handleClick = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    onJump?.(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  // Render logic
  const labels: Record<string, string> = copy.labels

  return (
    <nav aria-label={copy.label} className="no-scrollbar -mx-1 -mb-2 flex gap-1 overflow-x-auto">
      {sections.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={handleClick(id)}
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-caption whitespace-nowrap transition-colors',
            active === id
              ? 'bg-primary-soft text-primary font-medium'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {labels[id] ?? id}
        </a>
      ))}
    </nav>
  )
}
