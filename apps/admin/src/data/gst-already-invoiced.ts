/**
 * "Already invoiced" in the GST invoices app: recording a tax invoice the merchant issued
 * outside Koomerce (by hand or in a previous billing system), and how such a record shows on
 * the invoice page and the order card. Split from `gst-invoices.ts`, which is near its size cap.
 * No em or en dashes.
 */
export const gstAlreadyInvoicedContent = {
  /** The Queue row's button. */
  action: 'Already invoiced',
  actionLabel: (order: string) => `${order} was already invoiced`,
  title: (order: string) => `${order} is already invoiced`,
  body: 'Record the invoice you issued earlier, by hand or in your previous billing system. With its number and date it counts in GSTR-1 and GSTR-3B like any invoice. No PDF is made or emailed.',
  /** Under the fields: the order can leave the queue without the old invoice's details. */
  blankHelp:
    "No longer have the number and date? Leave both blank. The order leaves the queue as invoiced outside Koomerce, details not recorded. Reported in your previous system's returns, not in Koomerce's.",
  /** Only one of number and date is filled in. */
  bothOrNeither: 'Add both the number and the date, or leave both blank.',
  /** Submit label when both are blank. */
  submitBlank: 'Mark as invoiced',
  recordedBlank: (order: string) => `${order} marked as already invoiced`,
  /** On the invoice page, the order card and the Invoices list: recorded without details. */
  noDetails: 'Invoiced outside Koomerce, details not recorded',
  noDetailsBody: "Reported in your previous system's returns, not in Koomerce's.",
  /** The Invoices list's date cell for one recorded without details. */
  noDate: 'Not recorded',
  /** The Queue's bulk action on ticked rows. */
  bulkAction: 'Mark as already invoiced',
  bulkTitle: (n: number) =>
    n === 1 ? 'Mark 1 order as already invoiced?' : `Mark ${n} orders as already invoiced?`,
  bulkBody:
    "For old orders invoiced in your previous system. They leave the queue for good, without an invoice number or date. Reported in your previous system's returns, not in Koomerce's. You can undo one from its invoice page.",
  bulkSubmit: 'Mark as invoiced',
  bulkDone: (n: number) =>
    n === 1 ? '1 order marked as already invoiced' : `${n} orders marked as already invoiced`,
  bulkSkipped: (n: number, reason: string) =>
    n === 1
      ? `1 order was left in the queue: ${reason}`
      : `${n} orders were left in the queue. First reason: ${reason}`,
  bulkFailed: 'Could not mark those orders as invoiced',
  number: 'Invoice number',
  numberHelp:
    'Exactly as printed on that invoice. Up to 16 letters, digits, / and -. A number already used this financial year is refused.',
  date: 'Invoice date',
  dateHelp: 'The date on that invoice. It decides the GST return month.',
  submit: 'Record invoice',
  recorded: (number: string) => `Recorded ${number}`,
  failed: 'Could not record that invoice',
  /** On the invoice page and the order card, in place of Print and Download. */
  outside: 'Recorded, invoiced outside Koomerce',
  /** Badge in the Invoices list: no PDF was made here, nothing to print or email. */
  notPrinted: 'Recorded · no PDF',
  /** Badge in the Invoices list: issued here, PDF never printed or downloaded yet. */
  notPrintedYet: 'Not printed',
  notPrintedHelp:
    'Invoiced outside Koomerce. Koomerce made no PDF, so it is not printed or emailed.',
  outsideBody:
    'This invoice was issued outside Koomerce, so there is no PDF here. It is counted in your GST returns.',
  /** Undo on the invoice page: a typo in the recorded number or date. */
  undoTitle: 'Undo Already invoiced',
  undoBody:
    'Recorded the wrong number or date? Undo it and the order goes back to the Queue, to issue here or record again. This is not possible once the month is marked filed. If the number was one of your own series, the series still skips it.',
  undo: 'Undo',
  undoConfirmTitle: (number: string) => `Undo ${number}?`,
  undoConfirmBody:
    'The order goes back to the Queue and this invoice leaves your GST returns until you issue or record it again.',
  undone: (number: string) => `${number} undone. The order is back in the Queue.`,
  undoFailed: 'Could not undo that invoice',
} as const
