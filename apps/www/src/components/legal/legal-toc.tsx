'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useState } from 'react'
import { legalContent as copy } from '@/data/legal'
import type { LegalSection } from '@/data/legal/types'

type LegalTocProps = { sections: readonly LegalSection[] }

function readProgress(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  if (scrollable <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)))
}

/** Sticky contents list: highlights the section being read and shows reading progress. */
export default function LegalToc({ sections }: LegalTocProps) {
  // Hooks
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '-120px 0px -65% 0px' },
    )
    for (const section of sections) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }
    const onScroll = () => setProgress(readProgress())
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [sections])

  return (
    <>
      <label className="relative block lg:hidden print:hidden">
        <span className="sr-only">{copy.onThisPage}</span>
        <select
          value={activeId}
          onChange={(event) => {
            window.location.hash = event.target.value
          }}
          className="h-11 w-full appearance-none rounded-lg border border-input bg-input-surface px-3 pr-9 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {sections.map((section, index) => (
            <option key={section.id} value={section.id}>
              {index + 1}. {section.title}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </label>
      <nav
        aria-label={copy.onThisPage}
        className="sticky top-28 hidden w-64 shrink-0 self-start lg:block print:hidden"
      >
        <progress
          value={progress}
          max={100}
          aria-label={copy.read}
          className="mb-4 block h-0.5 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground [&::-webkit-progress-value]:transition-[width]"
        />
        <p className="mb-3 flex justify-between text-eyebrow">
          <span>{copy.onThisPage}</span>
          <span>
            {progress}% {copy.read}
          </span>
        </p>
        <ul className="flex flex-col">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={activeId === section.id ? 'location' : undefined}
                className={cn(
                  'block border-l-2 py-2 pl-4 text-sm transition-colors duration-(--duration-press) ease-out',
                  activeId === section.id
                    ? 'border-foreground text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#top"
          className="mt-6 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {copy.backToTop}
        </a>
      </nav>
    </>
  )
}
