import type { ReactNode } from 'react'

/** How a row is drawn: at rest, as the landing slot of a pointer drag, picked up by keyboard, or under the pointer. */
export type SortableRowState = 'row' | 'placeholder' | 'lifted' | 'overlay'

/** Screen reader copy for a flat list. The consumer owns the words (they live in its data file). */
export type SortableListLabels = {
  instructions: string
  handle: (title: string) => string
  picked: (title: string) => string
  moved: (title: string, position: number, total: number) => string
  dropped: (title: string, position: number, total: number) => string
  cancelled: (title: string) => string
}

/** Screen reader copy for a tree: positions also carry the level. */
export type SortableTreeLabels = {
  instructions: string
  handle: (title: string) => string
  picked: (title: string) => string
  position: (title: string, position: number, total: number, level: number) => string
  dropped: (title: string, position: number, total: number, level: number) => string
  cancelled: (title: string) => string
}

export type SortableTreeRowContext<T> = {
  item: T
  depth: number
  state: SortableRowState
  hasChildren: boolean
  collapsed: boolean
  /** Descendants travelling with the dragged row; set on the overlay only. */
  carried: number
  /** The drag handle, wired to the sortable; place it at the start of the row. */
  handle: ReactNode
  onToggle: () => void
}
