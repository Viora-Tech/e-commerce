'use client'

import { Braces, FileText, Lock, SquareTerminal, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy } from '@/hooks/use-copy'

export type CodeTab = { path: string; label: string; locked: boolean; dirty: boolean }

type CodeTabsProps = {
  tabs: readonly CodeTab[]
  active: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
  /** The right end of the strip: "Save ⌘S" while unsaved, "Fix 1 problem to save" while broken. */
  action?: ReactNode
}

function iconFor(tab: CodeTab) {
  if (tab.locked) return Lock
  if (tab.path.endsWith('.json')) return Braces
  if (/\.(css|scss|js|mjs)$/.test(tab.path)) return SquareTerminal
  return FileText
}

/** Open files as tabs (Figma 699:93624): an amber dot while unsaved, a close button on each. */
export default function CodeTabs({ tabs, active, onSelect, onClose, action }: CodeTabsProps) {
  // Hooks
  const copy = useCopy(themeCodeContent.tabs)

  // Render logic
  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-border bg-card">
      <div
        role="tablist"
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto no-scrollbar"
      >
        {tabs.map((tab) => {
          const Icon = iconFor(tab)
          const selected = tab.path === active
          return (
            <div
              key={tab.path}
              className={cn(
                'group flex shrink-0 items-center gap-2 border-r border-border pr-2 pl-4 text-body',
                selected ? 'bg-background text-foreground' : 'text-muted-foreground',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelect(tab.path)}
                className="flex h-full items-center gap-2 focus-visible:outline-none focus-visible:underline"
              >
                <Icon aria-hidden className="size-3.5" />
                {tab.label}
              </button>
              {tab.dirty ? <span aria-hidden className="size-1.5 rounded-full bg-warning" /> : null}
              <button
                type="button"
                onClick={() => onClose(tab.path)}
                aria-label={copy.close(tab.label)}
                className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-60 transition hover:bg-muted hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden className="size-3" />
              </button>
            </div>
          )
        })}
      </div>
      {action ? <div className="flex shrink-0 items-center pr-4 pl-2">{action}</div> : null}
    </div>
  )
}
