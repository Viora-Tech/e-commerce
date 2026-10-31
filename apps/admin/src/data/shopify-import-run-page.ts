/** Copy for a Shopify import run (the run page, its problems and retries); part of shopifyImportContent. */

/** `3 records`, `1 record`: a count with its noun. */
export const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

export const shopifyImportRunPageContent = {
  back: 'Imports',
  title: (preview: boolean) => (preview ? 'Import preview' : 'Import'),
  from: (source: string) => `From ${source}`,
  waiting: 'Waiting for the worker to pick this up.',
  running: 'Working through your data. You can leave this page; it keeps going.',
  previewDone: 'Nothing has been written yet. Check the counts and problems below, then import.',
  previewReuse:
    'Import now uses what this preview already read from Shopify, and only asks Shopify for what changed since. Import within a day to save the wait.',
  usingPreview: (when: string, changes: number) =>
    `Using the preview from ${when} + ${plural(changes, 'change', 'changes')} since.`,
  importDone:
    'Import finished. Running it again updates what it created instead of duplicating it.',
  failed: 'The import stopped.',
  stopped: (who: string | null, when: string) =>
    who ? `Stopped by ${who} at ${when}.` : `Stopped at ${when}.`,
  stoppedKeeps:
    'What was already imported stays. Bring in the rest with Run again, or Retry the ones that were missed.',
  stopping: 'Stopping… the import ends within a few seconds.',
  stop: {
    button: 'Stop import',
    title: 'Stop this import?',
    body: 'What’s already imported stays. You can bring in the rest later with Run again or Retry.',
    confirm: 'Stop import',
    keep: 'Keep importing',
    done: 'Import stopped',
    asked: 'Stopping the import',
    failed: 'Couldn’t stop the import',
  },
  importNow: 'Import now',
  runAgain: 'Run again',
  tryAgain: 'Try again',
  started: 'Import started',
  startFailed: 'Could not start the import',
  phase: {
    products: 'Asking Shopify to prepare your products…',
    customers: 'Asking Shopify to prepare your customers…',
    orders: 'Asking Shopify to prepare your orders…',
  },
  progressHeading: 'By type',
  columns: {
    what: 'Type',
    progress: 'Progress',
    created: 'New',
    updated: 'Updated',
    skipped: 'Skipped',
    failed: 'Failed',
  },
  counted: (processed: number, total: number) =>
    `${processed.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`,
  sampleHeading: 'Sample of what will change',
  sampleAction: { create: 'New', update: 'Update', skip: 'Skip' },
  issuesHeading: (n: number) => plural(n, 'problem', 'problems'),
  issuesNone: 'No problems found.',
  issueColumns: { where: 'Where', what: 'Record', message: 'Problem' },
  line: (n: number) => `Line ${n}`,
  notFound: 'This import no longer exists.',
  previous: 'Previous page',
  next: 'Next page',
  retryMissed: (n: number) =>
    n === 1
      ? 'Retry the 1 that was missed'
      : `Retry the ${n.toLocaleString('en-IN')} that were missed`,
  retryFailed: 'Could not start the retry',
  importAll: 'Import everything again',
  retrying: 'Retrying only what the last import missed. Everything else is left as it is.',
  remainingRun:
    'Importing only what was not here yet, or had a problem last time. Everything else is left as it is.',
  now: (what: string, done: number, total: number) =>
    `${what}: ${done.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`,
  problems: {
    showAll: 'Show every record',
    showGrouped: 'Group by cause',
    unit: (n: number) =>
      `${plural(n, 'record', 'records')} to retry: one record can have several problems, such as several images.`,
    example: 'For example:',
    retryable: (n: number) => `${plural(n, 'record', 'records')} can be retried`,
    retryableImages: (images: number, records: number) =>
      `${plural(images, 'image', 'images')} can be retried with the ${plural(records, 'record', 'records')} they belong to`,
    retryableFiles: (files: number, records: number) =>
      `${plural(files, 'file', 'files')} can be retried (${plural(records, 'record', 'records')})`,
    fix: { storage: 'Connect storage', scope: 'Add the access' },
    cause: {
      storage: (n: number) =>
        `${plural(n, 'image or file', 'images and files')} not copied: file storage isn’t working`,
      scope: (n: number) => `${plural(n, 'type', 'types')} Shopify didn’t let us read`,
      order_number: (n: number) =>
        `${plural(n, 'order', 'orders')} skipped: the order number is already used here`,
      image: (n: number) => `${plural(n, 'image', 'images')} couldn’t be copied`,
      file: (n: number) => `${plural(n, 'file', 'files')} couldn’t be copied`,
      record: (n: number) => `${plural(n, 'record', 'records')} couldn’t be saved`,
      note: (n: number) => `${plural(n, 'note', 'notes')} about what changed or stayed in Shopify`,
    },
  },
}
