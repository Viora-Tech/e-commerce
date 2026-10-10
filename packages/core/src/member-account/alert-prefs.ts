/** SOURCE OF TRUTH: member alerts, personal notifications — WHAT: which store events reach a team member by email or WhatsApp, and when their daily summary goes (Account → Notifications), with the defaults / WHY: one shape for the admin page, the API and the worker that sends them; pure and client-safe */
import { z } from 'zod'

/** The events a member can be told about, in the order the page lists them. */
export const MEMBER_ALERTS = [
  'newOrder',
  'lowStock',
  'paymentProblem',
  'dailySummary',
  'appErrors',
] as const

export type MemberAlert = (typeof MEMBER_ALERTS)[number]

/** Channels a member alert can use. WhatsApp only where the store has WhatsApp set up. */
export type AlertChannel = 'email' | 'whatsapp'

export type AlertSwitches = Record<AlertChannel, boolean>

export type MemberAlertPrefs = Record<Exclude<MemberAlert, 'dailySummary'>, AlertSwitches> & {
  dailySummary: AlertSwitches & {
    /** IST hour (0–23) the summary goes out. */
    hour: number
    /** IST day (YYYY-MM-DD) the last summary went, so a day never gets two. Server-owned. */
    lastSentOn: string | null
  }
}

/** Evening, after most orders are in. */
const DAILY_SUMMARY_DEFAULT_HOUR = 20

const off: AlertSwitches = { email: false, whatsapp: false }
const byEmail: AlertSwitches = { email: true, whatsapp: false }

/**
 * Before a member has saved anything: the owner hears about new orders, payment problems and
 * app errors by email; everyone else starts quiet, so a store with ten staff does not send ten
 * copies of every order. The daily summary is opt-in for all.
 */
function defaultMemberAlertPrefs(isOwner: boolean): MemberAlertPrefs {
  const owner = isOwner ? byEmail : off
  return {
    newOrder: owner,
    lowStock: off,
    paymentProblem: owner,
    dailySummary: { ...off, hour: DAILY_SUMMARY_DEFAULT_HOUR, lastSentOn: null },
    appErrors: owner,
  }
}

const switches = z.object({ email: z.boolean(), whatsapp: z.boolean() })

/** What Account → Notifications saves; `lastSentOn` stays the server's. */
export const MemberAlertPrefsInputSchema = z.object({
  newOrder: switches,
  lowStock: switches,
  paymentProblem: switches,
  dailySummary: switches.extend({ hour: z.number().int().min(0).max(23) }),
  appErrors: switches,
})

export type MemberAlertPrefsInput = z.infer<typeof MemberAlertPrefsInputSchema>

const stored = MemberAlertPrefsInputSchema.extend({
  dailySummary: MemberAlertPrefsInputSchema.shape.dailySummary.extend({
    lastSentOn: z.string().nullable().optional(),
  }),
})

/** The stored JSON as prefs; anything missing or malformed falls back to the defaults. */
export function parseMemberAlertPrefs(raw: unknown, isOwner: boolean): MemberAlertPrefs {
  const parsed = stored.safeParse(raw)
  if (!parsed.success) return defaultMemberAlertPrefs(isOwner)
  const p = parsed.data
  return {
    ...p,
    dailySummary: { ...p.dailySummary, lastSentOn: p.dailySummary.lastSentOn ?? null },
  }
}

/** True when this alert should reach the member on any channel. */
export function alertOn(prefs: MemberAlertPrefs, alert: MemberAlert): boolean {
  return prefs[alert].email || prefs[alert].whatsapp
}
