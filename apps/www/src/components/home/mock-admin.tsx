'use client'

import { ShieldCheck_ as ShieldCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type KeyboardEvent, useState } from 'react'
import { mockAdminContent as copy, type MockTab } from '@/data/mock-admin'
import MockAiBox from './mock-ai-box'
import MockScreen from './mock-screen'

/** A light, interactive stand-in for the admin: sidebar tabs switch the screen, rows react to hover, the AI box answers. */
export default function MockAdmin() {
  // Hooks
  const [tab, setTab] = useState<MockTab>('home')

  // Event handlers
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys = copy.tabs.map((item) => item.key)
    const index = keys.indexOf(tab)
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0
    if (!step) return
    event.preventDefault()
    const next = keys[(index + step + keys.length) % keys.length]
    if (next) {
      setTab(next)
      document.getElementById(`mock-tab-${next}`)?.focus()
    }
  }

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="flex h-9 items-center gap-3 border-b border-border bg-muted/40 px-3">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          <span className="size-2 rounded-full bg-muted-foreground/40" />
        </span>
        <span className="mx-auto flex h-6 max-w-xs flex-1 items-center justify-center gap-1.5 rounded-md bg-background/60 px-3 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3" />
          <span className="truncate">
            {copy.url}/{tab === 'home' ? '' : tab}
          </span>
        </span>
      </div>
      <div className="flex flex-col sm:flex-row">
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label={copy.navLabel}
          className="flex gap-1 border-b border-border p-2 sm:w-32 sm:flex-col sm:border-r sm:border-b-0"
        >
          <p className="hidden px-2 pt-1 pb-2 text-xs font-semibold text-foreground sm:block">
            {copy.store}
          </p>
          {copy.tabs.map((item) => {
            const selected = item.key === tab
            return (
              <button
                key={item.key}
                id={`mock-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="mock-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.key)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-left text-xs font-medium outline-none transition-colors duration-(--duration-press) ease-out focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            id="mock-panel"
            role="tabpanel"
            aria-labelledby={`mock-tab-${tab}`}
            className="min-h-56 flex-1 p-4"
          >
            <MockScreen key={tab} tab={tab} />
          </div>
          <MockAiBox />
        </div>
      </div>
    </div>
  )
}
