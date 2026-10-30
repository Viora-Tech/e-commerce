'use client'

import { ChevronLeftIcon, ChevronRight } from '@commerce/ui/icons'
import { useQueryState } from 'nuqs'
import { createContext, type ReactNode, useContext, useEffect } from 'react'

export type DrillRow = {
  id: string
  title: string
  /** The current value or status in a few words ("Required", "₹499", "On"). */
  value?: string | undefined
}

type SettingsDrillProps = {
  rows: readonly DrillRow[]
  /** The back row's label inside a detail: the page's own name. */
  backLabel: string
  children: ReactNode
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'

/** `undefined` outside a drill (every panel renders); `null` on the row list; else the open id. */
const OpenRowContext = createContext<string | null | undefined>(undefined)

/** Should the panel `id` render? Always outside a `SettingsDrill`. */
export function useDrillOpen(id: string): boolean {
  const open = useContext(OpenRowContext)
  return open === undefined || open === id
}

/**
 * Shopify's settings pattern (#147): the page is a short list of rows, each with its current
 * value and a ›; a row opens its detail in place with a "‹ Page" row to come back. The URL
 * (`?open=`) remembers the detail, and an old `#anchor` link opens the row of that id.
 */
export default function SettingsDrill({ rows, backLabel, children }: SettingsDrillProps) {
  // Hooks
  const [open, setOpen] = useQueryState('open')
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the address the page opened on
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && rows.some((r) => r.id === hash)) setOpen(hash)
  }, [])

  // Event handlers
  const handleOpen = (id: string | null) => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.href.split('#')[0])
    }
    setOpen(id)
    document.getElementById('main')?.scrollTo({ top: 0 })
  }

  // Render logic
  const current = rows.some((r) => r.id === open) ? open : null

  return (
    <OpenRowContext.Provider value={current}>
      {current ? (
        <button
          type="button"
          onClick={() => handleOpen(null)}
          className={`-ml-1 inline-flex h-9 items-center gap-1 self-start rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4 ${FOCUS}`}
        >
          <ChevronLeftIcon aria-hidden="true" />
          {backLabel}
        </button>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl surface-card">
          {rows.map((r) => (
            <li key={r.id} className="border-hairline border-b last:border-b-0">
              <button
                type="button"
                onClick={() => handleOpen(r.id)}
                className={`group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/60 ${FOCUS}`}
              >
                <span className="min-w-0 flex-1 text-body font-medium text-ink-strong">
                  {r.title}
                </span>
                {r.value ? (
                  <span className="max-w-[55%] truncate text-body text-muted-foreground">
                    {r.value}
                  </span>
                ) : null}
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {children}
    </OpenRowContext.Provider>
  )
}
