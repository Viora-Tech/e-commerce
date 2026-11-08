import type {
  ColumnOrderState,
  ColumnVisibilityState,
  SortingState,
  Updater,
} from '@tanstack/react-table'
import { useEffect, useRef, useState } from 'react'
import type { FilterGroup } from '@/components/table/filter-panel'

/** A table's sort as the page keeps it (in the URL): one column and its direction. */
export type TableSort = { id: string; desc: boolean }

/** A column's width classes and its smallest readable width, as the table measures them. */
export type ColumnWidth = { className?: string | undefined; minWidth?: number | undefined }

/** The smallest width (rem) a column without its own width keeps before the table scrolls. */
const DEFAULT_MIN_REM = 8

const PERCENT = /(?:^|\s)w-\[(\d+(?:\.\d+)?)%\]/
const ARBITRARY_REM = /(?:^|\s)w-\[(\d+(?:\.\d+)?)rem\]/
const SPACING = /(?:^|\s)w-(\d+(?:\.\d+)?)(?:\s|$)/

/**
 * The table's minimum width in rem (#10). A fixed table hands `w-[20%]` columns their share first
 * and splits what is left between the rest, so turning on extra columns used to squeeze Date and
 * Status into each other. The width is raised until every unsized column keeps its minimum after
 * the percentage columns take theirs, and each percentage column keeps any minimum it names; past
 * that the table scrolls sideways. Never narrower than the old 8rem-per-column rule.
 */
export function tableMinWidth(columns: ColumnWidth[]): number {
  let percent = 0
  let percentFloor = 0
  let fixed = 0
  let flexible = 0
  for (const column of columns) {
    const className = column.className ?? ''
    const share = PERCENT.exec(className)
    // A percentage column keeps a minimum only when it names one.
    const min = column.minWidth ?? (share ? 0 : DEFAULT_MIN_REM)
    const rem = ARBITRARY_REM.exec(className)
    const spacing = SPACING.exec(className)
    if (share) {
      const part = Number(share[1]) / 100
      percent += part
      percentFloor = Math.max(percentFloor, min / part)
    } else if (rem) fixed += Number(rem[1])
    else if (spacing) fixed += Number(spacing[1]) / 4
    else flexible += min
  }
  // Percentages that (nearly) fill the row still leave the others a quarter, never a sliver.
  const rest = Math.max(0.25, 1 - percent)
  const needed = Math.max(percentFloor, (fixed + flexible) / rest)
  return Math.ceil(Math.max(40, columns.length * DEFAULT_MIN_REM, needed))
}

/** What decides which rows the list shows: its view, filters, search and page. */
export type ListScope = {
  view: unknown
  filterGroups: FilterGroup[] | undefined
  applied: { key: string; label: string }[] | undefined
  query: string
  page: number
  perPage: number
}

/**
 * One string per set of shown rows. When it changes (another tab or view, a filter, a search, a
 * page) the rows on screen are different ones, so a selection made before no longer applies.
 */
export function listScopeKey(scope: ListScope): string {
  return JSON.stringify([
    scope.view ?? null,
    (scope.filterGroups ?? []).map((g) => [
      g.key,
      g.type === 'range' ? [g.from, g.to ?? ''] : g.value,
    ]),
    (scope.applied ?? []).map((a) => [a.key, a.label]),
    scope.query,
    scope.page,
    scope.perPage,
  ])
}

/** Runs `clear` whenever `key` changes after the first render (not on mount). */
export function useClearOnChange(key: string, clear: () => void) {
  // Hooks
  const last = useRef(key)
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new key clears; `clear` is a fresh arrow each render.
  useEffect(() => {
    if (last.current === key) return
    last.current = key
    clear()
  }, [key])
}

/** Sorting state, owned by the page when it passes `sort` (kept in the URL), else kept here. */
export function useTableSorting(
  defaultSort: TableSort | undefined,
  controlled: {
    sort: TableSort | null | undefined
    onSortChange?: (sort: TableSort | null) => void
  },
) {
  // Hooks
  const [own, setOwn] = useState<SortingState>(defaultSort ? [defaultSort] : [])

  // Render logic
  const isControlled = controlled.onSortChange !== undefined
  const fromPage = controlled.sort ?? defaultSort
  const value: SortingState = isControlled ? (fromPage ? [fromPage] : []) : own
  const set = (next: Updater<SortingState>) => {
    const resolved = typeof next === 'function' ? next(value) : next
    if (!controlled.onSortChange) return setOwn(resolved)
    const first = resolved[0]
    controlled.onSortChange(first ? { id: first.id, desc: first.desc } : null)
  }
  return [value, set] as const
}

type SavedColumns = { visibility: ColumnVisibilityState; order: ColumnOrderState }

function readSaved(key: string): SavedColumns | null {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    const { visibility, order } = parsed as Partial<SavedColumns>
    return {
      visibility:
        visibility && typeof visibility === 'object'
          ? Object.fromEntries(
              Object.entries(visibility).filter(([, shown]) => typeof shown === 'boolean'),
            )
          : {},
      order: Array.isArray(order) ? order.filter((id) => typeof id === 'string') : [],
    }
  } catch {
    // Storage can be blocked (private window); the defaults are fine.
    return null
  }
}

function writeSaved(key: string, saved: SavedColumns | null) {
  try {
    if (saved) window.localStorage.setItem(key, JSON.stringify(saved))
    else window.localStorage.removeItem(key)
  } catch {
    // Not remembered this time; the table still changes.
  }
}

/**
 * The shown columns and their order. With `storageKey` the viewer's choice is remembered in this
 * browser (#9): first paint uses the defaults, then the saved choice is laid over them, so a
 * column added later still starts with its default.
 */
export function useColumnPrefs(
  storageKey: string | undefined,
  defaultHidden: string[] | undefined,
) {
  // Hooks
  const defaults = () => Object.fromEntries((defaultHidden ?? []).map((id) => [id, false]))
  const [visibility, setVisibility] = useState<ColumnVisibilityState>(defaults)
  const [order, setOrder] = useState<ColumnOrderState>([])

  // biome-ignore lint/correctness/useExhaustiveDependencies: read once per storage key; the defaults are a constant per page.
  useEffect(() => {
    if (!storageKey) return
    const saved = readSaved(storageKey)
    if (!saved) return
    setVisibility({ ...defaults(), ...saved.visibility })
    setOrder(saved.order)
  }, [storageKey])

  // Event handlers
  const changeVisibility = (next: Updater<ColumnVisibilityState>) => {
    const resolved = typeof next === 'function' ? next(visibility) : next
    setVisibility(resolved)
    if (storageKey) writeSaved(storageKey, { visibility: resolved, order })
  }
  const changeOrder = (next: Updater<ColumnOrderState>) => {
    const resolved = typeof next === 'function' ? next(order) : next
    setOrder(resolved)
    if (storageKey) writeSaved(storageKey, { visibility, order: resolved })
  }
  const reset = () => {
    setVisibility(defaults())
    setOrder([])
    if (storageKey) writeSaved(storageKey, null)
  }

  return { visibility, order, changeVisibility, changeOrder, reset }
}
