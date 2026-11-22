/** SOURCE OF TRUTH: member alerts, personal notifications — WHAT: which store events reach a team member by email, WhatsApp or browser push, and when their daily summary goes (Account → Notifications), with the defaults / WHY: one shape for the admin page, the API and the worker that sends them; pure and client-safe */
import { z } from 'zod'

/** The events a member can be told about, in the order the page lists them. */
export const MEMBER_ALERTS = [
  'newOrder',
  'inboxMessage',
  'approvalWaiting',
  'lowStock',
  'paymentProblem',
  'dailySummary',
  'weeklyReport',
  'monthlyReport',
  'appErrors',
  'bugReports',
] as const

export type MemberAlert = (typeof MEMBER_ALERTS)[number]

/**
 * Channels a member alert can use. WhatsApp only where the store has WhatsApp set up; push only
 * reaches the browsers and phones the member turned it on for.
 */
export type AlertChannel = 'email' | 'whatsapp' | 'push'

export type AlertSwitches = Record<AlertChannel, boolean>

/** The alerts browser push carries (the owner's 16 Nov 2026 list: orders, Inbox, approvals, problems). */
const PUSH_ALERTS = [
  'newOrder',
  'inboxMessage',
  'approvalWaiting',
  'lowStock',
  'paymentProblem',
  'appErrors',
] as const satisfies readonly MemberAlert[]

export type PushAlert = (typeof PUSH_ALERTS)[number]

export const isPushAlert = (alert: MemberAlert): alert is PushAlert =>
  (PUSH_ALERTS as readonly MemberAlert[]).includes(alert)

/** The performance reports that go on a fixed day: Monday 9:00 and the 1st at 9:00 (IST). */
export const MEMBER_REPORTS = ['weeklyReport', 'monthlyReport'] as const
export type MemberReport = (typeof MEMBER_REPORTS)[number]

/** Alerts that go by email only: the reports are long, laid-out emails with no WhatsApp form. */
export const EMAIL_ONLY_ALERTS: ReadonlySet<MemberAlert> = new Set<MemberAlert>(MEMBER_REPORTS)

/** Alerts with only on/off switches per channel. */
type PlainAlert = Exclude<MemberAlert, 'dailySummary' | MemberReport>

export type ReportSwitches = AlertSwitches & {
  /** The period the last report covered (`2026-11-09` week start, `2026-10` month). Server-owned. */
  lastSentOn: string | null
}

export type MemberAlertPrefs = Record<PlainAlert, AlertSwitches> &
  Record<MemberReport, ReportSwitches> & {
    dailySummary: AlertSwitches & {
      /** IST hour (0–23) the summary goes out. */
      hour: number
      /** IST day (YYYY-MM-DD) the last summary went, so a day never gets two. Server-owned. */
      lastSentOn: string | null
    }
  }

/** Evening, after most orders are in. */
const DAILY_SUMMARY_DEFAULT_HOUR = 20

const off: AlertSwitches = { email: false, whatsapp: false, push: false }
const byEmail: AlertSwitches = { email: true, whatsapp: false, push: false }

/**
 * Push starts on for every push alert: nothing reaches a member until they turn push on for a
 * device, and that is the choice that matters. Their role still decides what they may hear about.
 */
const pushDefault = (alert: MemberAlert): boolean => isPushAlert(alert)

/**
 * Before a member has saved anything: the owner hears about new orders, unanswered chats, payment
 * problems and app errors by email; everyone else starts quiet, so a store with ten staff does not send ten
 * copies of every order. The daily summary and the weekly and monthly reports are opt-in for all. News on a bug the member reported
 * themselves reaches everyone by email: it is only ever about their own report.
 */
function defaultMemberAlertPrefs(isOwner: boolean): MemberAlertPrefs {
  const owner = isOwner ? byEmail : off
  const withPush = (s: AlertSwitches, alert: MemberAlert): AlertSwitches => ({
    ...s,
    push: pushDefault(alert),
  })
  return {
    newOrder: withPush(owner, 'newOrder'),
    // The owner hears about chats nobody answered (owner, 22 Nov 2026); the team opts in.
    inboxMessage: withPush(owner, 'inboxMessage'),
    approvalWaiting: withPush(off, 'approvalWaiting'),
    lowStock: withPush(off, 'lowStock'),
    paymentProblem: withPush(owner, 'paymentProblem'),
    dailySummary: { ...off, hour: DAILY_SUMMARY_DEFAULT_HOUR, lastSentOn: null },
    weeklyReport: { ...off, lastSentOn: null },
    monthlyReport: { ...off, lastSentOn: null },
    appErrors: withPush(owner, 'appErrors'),
    bugReports: byEmail,
  }
}

const switches = z.object({ email: z.boolean(), whatsapp: z.boolean(), push: z.boolean() })

/** What Account → Notifications saves; `lastSentOn` stays the server's. */
export const MemberAlertPrefsInputSchema = z.object({
  newOrder: switches,
  inboxMessage: switches,
  approvalWaiting: switches,
  lowStock: switches,
  paymentProblem: switches,
  dailySummary: switches.extend({ hour: z.number().int().min(0).max(23) }),
  weeklyReport: switches,
  monthlyReport: switches,
  appErrors: switches,
  bugReports: switches,
})

export type MemberAlertPrefsInput = z.infer<typeof MemberAlertPrefsInputSchema>

/**
 * Stored prefs are older than some alerts and channels: a missing alert takes its default, a
 * missing `push` (saved before push existed) takes the push default, so nobody's saved email
 * choices are lost when a channel is added.
 */
const storedSwitches = z.object({
  email: z.boolean(),
  whatsapp: z.boolean(),
  push: z.boolean().optional(),
})
const storedReport = storedSwitches.extend({ lastSentOn: z.string().nullable().optional() })
const stored = z.object({
  newOrder: storedSwitches,
  inboxMessage: storedSwitches.optional(),
  approvalWaiting: storedSwitches.optional(),
  lowStock: storedSwitches,
  paymentProblem: storedSwitches,
  dailySummary: storedSwitches.extend({
    hour: z.number().int().min(0).max(23),
    lastSentOn: z.string().nullable().optional(),
  }),
  weeklyReport: storedReport.optional(),
  monthlyReport: storedReport.optional(),
  appErrors: storedSwitches,
  bugReports: storedSwitches.optional(),
})

/** The stored JSON as prefs; anything missing or malformed falls back to the defaults. */
export function parseMemberAlertPrefs(raw: unknown, isOwner: boolean): MemberAlertPrefs {
  const defaults = defaultMemberAlertPrefs(isOwner)
  const parsed = stored.safeParse(raw)
  if (!parsed.success) return defaults
  const p = parsed.data
  const fill = (alert: PlainAlert, s: z.infer<typeof storedSwitches> | undefined): AlertSwitches =>
    s
      ? { email: s.email, whatsapp: s.whatsapp, push: s.push ?? pushDefault(alert) }
      : defaults[alert]
  // Email only: a WhatsApp switch saved by hand never sends, so it is stored off.
  const report = (
    s: z.infer<typeof storedReport> | undefined,
    fallback: ReportSwitches,
  ): ReportSwitches =>
    s
      ? { email: s.email, whatsapp: false, push: false, lastSentOn: s.lastSentOn ?? null }
      : fallback
  return {
    newOrder: fill('newOrder', p.newOrder),
    inboxMessage: fill('inboxMessage', p.inboxMessage),
    approvalWaiting: fill('approvalWaiting', p.approvalWaiting),
    lowStock: fill('lowStock', p.lowStock),
    paymentProblem: fill('paymentProblem', p.paymentProblem),
    dailySummary: {
      email: p.dailySummary.email,
      whatsapp: p.dailySummary.whatsapp,
      push: p.dailySummary.push ?? false,
      hour: p.dailySummary.hour,
      lastSentOn: p.dailySummary.lastSentOn ?? null,
    },
    weeklyReport: report(p.weeklyReport, defaults.weeklyReport),
    monthlyReport: report(p.monthlyReport, defaults.monthlyReport),
    appErrors: fill('appErrors', p.appErrors),
    bugReports: fill('bugReports', p.bugReports),
  }
}

/** True when this alert should reach the member by email or WhatsApp (push is checked on its own). */
export function alertOn(prefs: MemberAlertPrefs, alert: MemberAlert): boolean {
  return prefs[alert].email || prefs[alert].whatsapp
}
