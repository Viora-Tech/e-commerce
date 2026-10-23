import type { RunStatus } from '@commerce/core/automations'

/** Records "Run automation" works on (the manual triggers of the Automations app). */
export type AutomationRecordType = 'order' | 'customer' | 'product'

/**
 * Automations on records: "Run automation" in More actions and the bulk bars of orders,
 * customers and products, and the "Automations" history card on their detail pages.
 */
export const automationRecordsContent = {
  /** More actions and bulk bar item. */
  run: 'Run automation',
  /** More actions: the runs page filtered to this record. */
  runs: 'Automation runs',
  nouns: {
    order: { one: 'order', many: 'orders' },
    customer: { one: 'customer', many: 'customers' },
    product: { one: 'product', many: 'products' },
  } satisfies Record<AutomationRecordType, { one: string; many: string }>,
  dialog: {
    title: 'Run automation',
    description: (count: number, noun: { one: string; many: string }) =>
      count === 1
        ? `Pick a workflow to run on this ${noun.one}. It runs once, as if its trigger had fired.`
        : `Pick a workflow to run on the ${count} selected ${noun.many}. Each one gets its own run.`,
    search: 'Search workflows',
    submit: 'Run',
    loading: 'Loading workflows…',
    empty: 'No workflow can be run by hand yet.',
    emptyBody:
      'In Automations, build a workflow that starts with "Run manually", switch it on, and it shows here.',
    openApp: 'Open Automations',
    noMatch: 'No workflow matches your search.',
    steps: (n: number) => (n === 1 ? '1 action' : `${n} actions`),
    asks: (n: number) => (n === 1 ? '1 asks before running' : `${n} ask before running`),
    lastRun: (ago: string) => `Last run ${ago}`,
    neverRun: 'Not run yet',
    notAllowed: 'You need permission for every action in this workflow to run it.',
    tooMany: (max: number) => `Select at most ${max} records to run an automation on.`,
    started: (started: number, skipped: number) => {
      const done = started === 1 ? 'Started 1 run' : `Started ${started} runs`
      return skipped === 0
        ? done
        : `${done}. ${skipped} ${skipped === 1 ? 'was' : 'were'} already running or could not start.`
    },
    viewRuns: 'View runs',
    failed: 'The automation did not start. Try again.',
  },
  history: {
    title: 'Automations',
    empty: (noun: string) => `No automation has run on this ${noun} yet.`,
    openApp: 'Open Automations',
    viewAll: 'View all',
    changed: 'Changed by it',
    error: 'Automation history could not load.',
  },
  statuses: {
    queued: 'Queued',
    running: 'In progress',
    waiting: 'Waiting',
    awaiting_approval: 'Needs approval',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    skipped: 'Skipped',
    converted: 'Converted',
    stopped: 'Stopped',
  } satisfies Record<RunStatus, string>,
}
