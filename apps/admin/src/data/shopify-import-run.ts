const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

/** The run page's header card, stat tiles, type cards, samples and problem groups. */
export const shopifyImportRunContent = {
  state: {
    waiting: 'Waiting to start',
    previewing: 'Previewing…',
    ready: 'Ready to import',
    importing: 'Importing…',
    done: 'Done',
    failed: 'Failed',
    stopped: 'Stopped',
  },
  started: (when: string) => `Started ${when}`,
  finished: (when: string) => `Finished ${when}`,
  previewAgain: 'Run preview again',
  previewAgainFailed: 'Could not start the preview',
  viewStore: 'View store',
  stats: {
    total: 'To bring over',
    created: 'New',
    updated: 'Updated',
    skipped: 'Skipped',
    failed: 'Failed',
  },
  types: {
    done: 'Done',
    created: (n: number) => `${n.toLocaleString('en-IN')} new`,
    updated: (n: number) => `${n.toLocaleString('en-IN')} updated`,
    skipped: (n: number) => `${n.toLocaleString('en-IN')} skipped`,
    failed: (n: number) => `${n.toLocaleString('en-IN')} failed`,
    nothing: (names: string) => `Nothing to bring: ${names}`,
  },
  left: {
    showAll: (n: number) => `Show all ${n.toLocaleString('en-IN')}`,
    showLess: 'Show less',
  },
  samples: {
    empty: 'Nothing to show for this type.',
    more: (n: number) => `And ${plural(n, 'more record', 'more records')} of this type`,
  },
  problems: {
    summary: (n: number) =>
      `${plural(n, 'thing needs', 'things need')} a look. Everything else went through.`,
    none: 'No problems',
    showRecords: 'Show every record',
    hideRecords: 'Back to groups',
  },
} as const
