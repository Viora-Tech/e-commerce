'use client'

import { type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import { customSectionsContent as copy } from '../../data/custom-sections'

type TabsSwitcherProps = { labels: string[]; panels: ReactNode[] }

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs; panels stay in the DOM. */
export default function TabsSwitcher({ labels, panels }: TabsSwitcherProps) {
  // Hooks
  const [active, setActive] = useState(0)
  const id = useId()

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = labels.length - 1
    const next =
      e.key === 'ArrowRight'
        ? active === last
          ? 0
          : active + 1
        : e.key === 'ArrowLeft'
          ? active === 0
            ? last
            : active - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (next === null) return
    e.preventDefault()
    setActive(next)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  // Render logic
  const current = Math.min(active, Math.max(0, labels.length - 1))

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={copy.tabs.label}
        onKeyDown={handleKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)]"
      >
        {labels.map((label, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: tab order is the identity here.
            key={i}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === current}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={i === current ? 0 : -1}
            onClick={() => setActive(i)}
            className={
              i === current
                ? '-mb-px border-b-2 border-current px-3 py-2 font-medium whitespace-nowrap'
                : '-mb-px border-b-2 border-transparent px-3 py-2 whitespace-nowrap text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: panels pair with their tab by position.
          key={i}
          role="tabpanel"
          id={`${id}-panel-${i}`}
          aria-labelledby={`${id}-tab-${i}`}
          hidden={i !== current}
        >
          {panel}
        </div>
      ))}
    </div>
  )
}
