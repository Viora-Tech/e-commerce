'use client'

import { CircleCheck, CircleDashed, TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

export type ChecklistState = 'done' | 'warn' | 'todo'

export type ChecklistItem = {
  id: string
  label: string
  state: ChecklistState
  /** Right-aligned hint: "6 photos", "No HS code", "Auto". */
  note?: string | undefined
}

type PageChecklistProps = {
  heading: string
  /** Header right side, e.g. "1 to fix"; drawn in the warning colour while anything needs fixing. */
  summary: string
  items: ChecklistItem[]
  active: string
  onSelect: (id: string) => void
}

const ICON = {
  done: <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />,
  warn: <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />,
  todo: <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />,
} as const

/** Figma "On this page" (631:7713): every section of a long editor with its state; a row jumps to it. */
export default function PageChecklist({
  heading,
  summary,
  items,
  active,
  onSelect,
}: PageChecklistProps) {
  // Render logic
  const fixing = items.some((item) => item.state === 'warn')

  return (
    <nav aria-label={heading} className="rounded-xl border border-border bg-card p-2">
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{heading}</p>
        <p className={cn('text-caption', fixing ? 'text-warning' : 'text-muted-foreground')}>
          {summary}
        </p>
      </div>
      <ul className="flex flex-col">
        {items.map((item) => {
          const current = item.id === active
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={current ? 'step' : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  'flex h-8.5 w-full items-center gap-2.5 rounded-md px-2 text-left text-body transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  current ? 'bg-muted font-medium text-ink-strong' : 'text-foreground',
                  item.state === 'todo' && !current && 'text-muted-foreground',
                )}
              >
                {ICON[item.state]}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.note ? (
                  <span
                    className={cn(
                      'shrink-0 text-caption font-normal',
                      item.state === 'warn' ? 'text-warning' : 'text-muted-foreground',
                    )}
                  >
                    {item.note}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
