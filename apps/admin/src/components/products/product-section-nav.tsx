'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type MouseEvent, useEffect, useState } from 'react'
import { productFormContent } from '@/data/product-form'
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
    <nav
      aria-label={copy.label}
      className="no-scrollbar inline-flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[0.6875rem] bg-muted p-[0.1875rem]"
    >
      {sections.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={handleClick(id)}
          className={cn(
            'flex h-[1.875rem] shrink-0 items-center rounded-[0.5rem] border px-3 text-body font-medium whitespace-nowrap transition-colors',
            active === id
              ? 'border-border bg-card font-semibold text-ink-strong shadow-lift'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {labels[id] ?? id}
        </a>
      ))}
    </nav>
  )
}
