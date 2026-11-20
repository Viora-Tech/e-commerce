/**
 * The performance report a team member gets by email (daily summary, weekly report, monthly
 * report: Account → Notifications). Every value is already formatted, so the email only lays it
 * out. Built by `@commerce/core` (member-account/report-figures.ts).
 */

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

/** A change against the period before: "▲ 18%" in green, "▼ 3%" in red. */
export type ReportChange = { label: string; up: boolean }

export type PerformanceReport = {
  period: ReportPeriod
  /** The small purple line on top: "WEEKLY REPORT · WEEK 46". */
  kicker: string
  /** "Your week at Waimers." */
  title: string
  /** "Monday 10 – Sunday 16 November". */
  periodLabel: string
  /** Net sales for the period, the big number. */
  netLabel: string
  change: ReportChange | null
  /** Next to the change: "vs ₹1,56,220 last week". */
  changeNote: string
  /** The one bar chart: days of the week, weeks of the month or times of the day. */
  bars: { label: string; valueLabel: string; value: number; best: boolean }[]
  /** Under the bars: "Saturday was your best day: 22 orders worth ₹42,100." */
  barNote: string | null
  /** Three or six figures, each with its change. */
  stats: { label: string; value: string; change: ReportChange | null }[]
  /** After each change: "vs last week". */
  vsLabel: string
  historyTitle: string
  /** Earlier periods as numbers, oldest first; the last one is this period. */
  history: { label: string; value: string }[]
  sellersTitle: string
  sellers: {
    title: string
    detail: string
    soldLabel: string
    amountLabel: string
    imageUrl: string | null
  }[]
  /** Where the period's buyers came from, as whole percentages; empty hides the block. */
  sources: { label: string; percent: number }[]
  todoTitle: string
  /** Things to act on, each with a small emoji in a white circle ("🛒"); empty hides the box. */
  todos: { icon: string; text: string; linkLabel: string; url: string }[]
  /** The daily summary puts the to-dos above the sellers: they are what the day is for. */
  todosFirst: boolean
  moneyTitle: string
  /** Gross, discounts, refunds; the net line is added under them. */
  money: { label: string; amount: string }[]
  button: { label: string; url: string }
  /** Analytics in the admin, linked from the footer. */
  analyticsUrl: string
  /** Account → Notifications in the admin, linked from the footer. */
  settingsUrl: string
  /** When it is sent: "Sent every Monday at 9:00 to staff who turned on the weekly report." */
  footer: string
}
