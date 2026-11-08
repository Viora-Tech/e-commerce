import type { ExpandedState, RowSelectionState, Updater } from '@tanstack/react-table'
import { isValidElement, type ReactNode, useState } from 'react'

/** The current view of the list's `ViewSelect` (its `value`), so a new tab or view is seen. */
export function viewOf(views: ReactNode): unknown {
  return isValidElement<{ value?: unknown }>(views) ? views.props.value : undefined
}

/** The table's row selection: the page's own (`selection`) when given, else kept here. */
export function useRowSelection(
  controlled: { ids: string[]; onChange: (ids: string[]) => void } | undefined,
) {
  const [own, setOwn] = useState<RowSelectionState>({})
  const value: RowSelectionState = controlled
    ? Object.fromEntries(controlled.ids.map((id) => [id, true]))
    : own
  const set = (next: Updater<RowSelectionState>) => {
    const resolved = typeof next === 'function' ? next(value) : next
    if (controlled) controlled.onChange(Object.keys(resolved).filter((id) => resolved[id]))
    else setOwn(resolved)
  }
  return [value, set] as const
}

/** The table's expanded rows: the page's own (`tree`), as TanStack state. */
export function useExpanded(
  tree:
    | { expanded: Record<string, boolean>; onExpandedChange: (e: Record<string, boolean>) => void }
    | undefined,
) {
  const value: ExpandedState = tree?.expanded ?? {}
  const set = (next: Updater<ExpandedState>, expandable: () => string[]) => {
    const resolved = typeof next === 'function' ? next(value) : next
    tree?.onExpandedChange(
      resolved === true ? Object.fromEntries(expandable().map((id) => [id, true])) : resolved,
    )
  }
  return [value, set] as const
}
