'use client'

import { ChevronLeftIcon, ChevronRight } from '@commerce/ui/icons'
import { useQueryState } from 'nuqs'
import { createContext, type ReactNode, useContext, useEffect } from 'react'
import PageHeader from '@/components/layout/page-header'

export type DrillRow = {
  id: string
  title: string
  /** The current value or status in a few words ("Required", "₹499", "On"). */
  value?: string | undefined
  /** Not built yet: a plain line with its value ("Coming soon"), not a row that opens (#69). */
  disabled?: boolean
  /** A one-switch setting: the switch sits in the row itself, with `value` as its hint (#100). */
  control?: ReactNode
  /** With `header`: the line under the row's title while its detail is open. */
  help?: ReactNode
  /** With `header`: the detail's own buttons, in the header while it is open (no floating row). */
  actions?: ReactNode
}

/** The page's title block, drawn by the drill so an open row can take it over. */
export type DrillHeader = {
  title: string
  subtitle?: ReactNode
  /** First screen only. */
  actions?: ReactNode
  badges?: ReactNode
  /** The page-wide Save: on every screen, since every detail edits the same form. */
  save?: { dirty: boolean; saving?: boolean; onSave: () => void; label?: string }
  /** A page-wide notice right under the header, on every screen ("AI is off"). */
  notice?: ReactNode
}

type SettingsDrillProps = {
  rows: readonly DrillRow[]
  /** The back row's label inside a detail: the page's own name. */
  backLabel: string
  /** Replaces the default row list on the page's first screen; open a row with `useDrillNav`. */
  home?: ReactNode
  /**
   * Opt in to one header: the page title on the first screen; inside a row, the row's title
   * with a single "‹ Page" link above it, in place of the back button under the page header.
   */
  header?: DrillHeader
  /** First screen only, above the row list (a status line). */
  before?: ReactNode
  /** First screen only: more under the row list (a link row to a sub-page). */
  after?: ReactNode
  children: ReactNode
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'

/** `undefined` outside a drill (every panel renders); `null` on the row list; else the open id. */
const OpenRowContext = createContext<string | null | undefined>(undefined)

/** The open row's title while the drill draws the header (`header`), so a card can skip it. */
const HeaderTitleContext = createContext<string | null>(null)

/** Opens a row's detail (`null`: back to the first screen). */
const NavContext = createContext<(id: string | null) => void>(() => undefined)

/** Should the panel `id` render? Always outside a `SettingsDrill`. */
export function useDrillOpen(id: string): boolean {
  const open = useContext(OpenRowContext)
  return open === undefined || open === id
}

/**
 * The title the page header already shows for the open row (only with `header`), so a card that
 * would repeat it as its own heading leaves it out.
 */
export function useDrillHeaderTitle(): string | null {
  return useContext(HeaderTitleContext)
}

/** Opens a row of the surrounding `SettingsDrill`, for a custom `home` screen. */
export function useDrillNav(): (id: string | null) => void {
  return useContext(NavContext)
}

/**
 * Shopify's settings pattern (#147): the page is a short list of rows, each with its current
 * value and a ›; a row opens its detail in place with a "‹ Page" row to come back. The URL
 * (`?open=`) remembers the detail, and an old `#anchor` link opens the row of that id.
 */
export default function SettingsDrill({
  rows,
  backLabel,
  home,
  header,
  before,
  after,
  children,
}: SettingsDrillProps) {
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
  const current = rows.some((r) => r.id === open && !r.disabled && !r.control) ? open : null
  const currentRow = current ? rows.find((r) => r.id === current) : undefined

  return (
    <NavContext.Provider value={handleOpen}>
      <OpenRowContext.Provider value={current}>
        <HeaderTitleContext.Provider value={header && currentRow ? currentRow.title : null}>
          {header ? (
            currentRow ? (
              <PageHeader
                title={currentRow.title}
                subtitle={currentRow.help}
                back={{ label: backLabel, onClick: () => handleOpen(null) }}
                actions={currentRow.actions}
                save={header.save}
              />
            ) : (
              <PageHeader
                title={header.title}
                subtitle={header.subtitle}
                badges={header.badges}
                actions={header.actions}
                save={header.save}
              />
            )
          ) : null}
          {header?.notice ?? null}
          {current ? null : before}
          {current && header ? null : current ? (
            <button
              type="button"
              onClick={() => handleOpen(null)}
              className={`-ml-1 inline-flex h-9 items-center gap-1 self-start rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4 ${FOCUS}`}
            >
              <ChevronLeftIcon aria-hidden="true" />
              {backLabel}
            </button>
          ) : home !== undefined ? (
            home
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-xl surface-card">
              {rows.map((r) => (
                <li key={r.id} className="border-hairline border-b last:border-b-0">
                  {r.control ? (
                    <div className="flex w-full items-center gap-3 px-5 py-4">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-body font-medium text-ink-strong">{r.title}</span>
                        {r.value ? (
                          <span className="text-caption text-muted-foreground">{r.value}</span>
                        ) : null}
                      </span>
                      {r.control}
                    </div>
                  ) : r.disabled ? (
                    <div className="flex w-full items-center gap-3 px-5 py-4" aria-disabled="true">
                      <span className="min-w-0 flex-1 text-body font-medium text-muted-foreground">
                        {r.title}
                      </span>
                      {r.value ? (
                        <span className="max-w-[55%] truncate text-body text-muted-foreground">
                          {r.value}
                        </span>
                      ) : null}
                    </div>
                  ) : (
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
                  )}
                </li>
              ))}
            </ul>
          )}
          {current ? null : after}
          {children}
        </HeaderTitleContext.Provider>
      </OpenRowContext.Provider>
    </NavContext.Provider>
  )
}
