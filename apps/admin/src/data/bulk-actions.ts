/** Shared words for bulk actions that loop one call per selected row. */
export const bulkActionsContent = {
  /** The summary toast once the loop is over: "8 done, 2 failed". */
  summary: (done: number, failed: number) =>
    failed === 0 ? `${done} done` : `${done} done, ${failed} failed`,
} as const
