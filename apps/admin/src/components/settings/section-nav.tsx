'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useState } from 'react'
import { settingsContent } from '@/data/settings'

export type SectionLink = { id: string; label: string }

type SectionNavProps = { sections: readonly SectionLink[] }

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Cloudflare's in-page nav: items sit on a hairline; the active one carries a
   2px marker over the line, offset by -1px so the two overlap. */
const ITEM = `relative -ml-px flex h-8 w-full items-center border-l-2 border-transparent pl-3 text-left text-nav text-muted-foreground transition-colors hover:text-foreground ${FOCUS}`
const ITEM_ACTIVE = 'border-primary font-medium text-ink-strong'

/** Anchor list for a long settings page; highlights the section in view and scrolls to the one clicked. */
export default function SectionNav({ sections }: SectionNavProps) {
  // Hooks
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null)

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top)
          else visible.delete(entry.target.id)
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0]
        if (top) setActiveId(top[0])
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    for (const el of targets) observer.observe(el)
    return () => observer.disconnect()
  }, [sections])

  // Event handlers
  const handleJump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  // Render logic
  return (
    <nav
      aria-label={settingsContent.nav.onThisPage}
      className="hidden w-44 shrink-0 self-start lg:sticky lg:top-20 lg:block"
    >
      <p className="mb-2 pl-3 text-caption text-muted-foreground-soft">
        {settingsContent.nav.onThisPage}
      </p>
      <ul className="flex flex-col border-border border-l">
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => handleJump(s.id)}
              aria-current={activeId === s.id ? 'location' : undefined}
              className={cn(ITEM, activeId === s.id && ITEM_ACTIVE)}
            >
              <span className="truncate">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
