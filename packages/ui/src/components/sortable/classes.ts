import type { SortableRowState } from './types'

/**
 * Row surfaces shared by every sortable, so a landing slot or a keyboard-lifted
 * row reads the same in a menu tree, a media grid or a table.
 */
export const ROW_STATE_CLASS: Record<Exclude<SortableRowState, 'overlay'>, string> = {
  row: 'bg-card',
  placeholder:
    'bg-primary-soft/60 outline-1 -outline-offset-1 outline-dashed outline-primary/60 *:opacity-40',
  lifted: 'bg-primary-soft/50 ring-2 ring-inset ring-primary',
}
