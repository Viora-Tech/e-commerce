/**
 * Copy for printing a batch's labels as one file (Figma 909:9249, the bulk result's Print card;
 * also Shipments › Booked's "Print labels"): the paper picker and what was left out.
 */
import type { LabelSheetSkipReason } from '@commerce/core'
import type { LabelSheetFormat } from '@commerce/core/label-sheet-layout'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const labelSheetContent = {
  paper: 'Label paper',
  formats: {
    thermal4x6: '4 × 6 in thermal · 1 per page',
    a4x4: 'A4 · 4 per page',
    original: 'Courier’s own size',
  } as Record<LabelSheetFormat, string>,
  making: 'Making the file…',
  failed: 'Could not make the label file. Try again.',
  noneReady: 'None of these labels is ready yet. The couriers have not sent them.',
  tooMany: (max: number) => `Print up to ${max} labels at a time. Select fewer and try again.`,
  /** Toast after printing when some were left out: "2 labels left out: #1047 not sent yet…". */
  leftOut: (n: number, list: string) => `${plural(n, 'label', 'labels')} left out: ${list}`,
  reasons: {
    not_found: 'not found',
    cancelled: 'cancelled',
    no_label: 'courier has not sent it yet',
    failed: 'courier did not hand it over, try again',
    unreadable: 'not a PDF',
  } as Record<LabelSheetSkipReason, string>,
}
