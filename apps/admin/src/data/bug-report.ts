/** "Report a bug" (test server only): the account menu item, the floating button and the dialog. */
export const bugReportContent = {
  open: 'Report a bug',
  title: 'Report a bug',
  intro: 'Tell us what went wrong. We also send the page you are on and any recent errors.',
  /** Shown after the intro when reports go to the public issue tracker. */
  publicNotice:
    'Reports are posted on our public issue tracker. Your name, email, store and screenshot are not posted.',
  summaryLabel: 'What went wrong?',
  summaryPlaceholder: 'For example: Save does nothing',
  detailsLabel: 'What were you doing just before?',
  detailsPlaceholder: 'Optional. The steps help us see it happen.',
  screenshotLabel: 'Include a screenshot of this page',
  screenshotHelp: 'It may show store details. It is only sent to our team.',
  screenshotAlt: 'Screenshot of the page that will be sent',
  screenshotFailed: 'A screenshot could not be taken. You can still send the report.',
  cancel: 'Cancel',
  send: 'Send',
  sending: 'Sending',
  sent: (n: number) => `Thanks, reported as #${n}`,
  view: 'View',
  logged: 'Thanks. Saved to the server log (no GitHub token on this server).',
  failed: 'The report was not sent. Try again in a minute.',
  /** The account menu's link to Account → My reports, and its unread dot's label. */
  myReports: 'My reports',
  myReportsUnread: (n: number) => (n === 1 ? '1 report has news' : `${n} reports have news`),
}

/** Account → My reports: the member's bug reports, what happened to each and the team's reply. */
export const myBugReportsContent = {
  title: 'My reports',
  intro: 'Bugs you reported from this store, and what our team did about each one.',
  scope: { mine: 'My reports', store: 'All reports from this store' },
  status: {
    received: 'Received',
    in_progress: 'Being fixed',
    fixed: 'Fixed – in the next update',
    live: 'Live',
    wont_fix: "Won't fix",
  },
  reported: (when: string) => `Reported ${when}`,
  reportedBy: (name: string, when: string) => `${name} reported ${when}`,
  issue: (n: number) => `#${n}`,
  page: 'Page',
  reply: 'Reply from our team',
  replyAt: (when: string) => `Replied ${when}`,
  noReply: 'No reply yet. We write here when there is news.',
  updated: 'New',
  screenshot: 'Screenshot',
  screenshotAlt: (title: string) => `Screenshot sent with "${title}"`,
  closeScreenshot: 'Close',
  empty: {
    title: 'No reports yet',
    body: 'When something does not work, use Report a bug in your account menu. You can follow it here.',
  },
  reportBug: 'Report a bug',
  loadFailed: 'Your reports could not be loaded.',
  retry: 'Try again',
}
